import asyncio, re, sys, json
from playwright.async_api import async_playwright
URL='http://localhost:8765/index.html'
errs=[]
async def snap_json(pg):
    return await pg.evaluate("FL.store.snap")
async def wait_phase(pg, phase, to=8000):
    await pg.wait_for_function("p => FL.store.snap && FL.store.snap.session.phase === p", arg=phase, timeout=to)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1280,'height':800}, locale='zh-TW')
        def hook(pg, name):
            pg.on('pageerror', lambda e: errs.append((name,'pageerror',str(e))))
            pg.on('console', lambda m: errs.append((name,m.text)) if m.type=='error' and '404' not in m.text else None)
        host = await ctx.new_page(); hook(host,'host')
        await host.goto(URL+'#/host')
        await host.fill('#h_key','secret123'); await host.click('[data-act=hcreate]')
        await host.wait_for_selector('.phasebar')
        code = (await host.inner_text('.pill.solid')).split()[-1]
        print('room', code)

        # bots
        await host.click('[data-act=htab][data-tab=tools]')
        await host.click('[data-act=hbots][data-n="8"]')
        await host.wait_for_function("FL.store.snap && FL.store.snap.teams.length>=8", timeout=8000)

        # shorter shifts for the test
        await host.click('[data-act=htab][data-tab=params]')
        await host.fill('input[data-k=secs]','3'); await host.press('input[data-k=secs]','Tab')
        await host.wait_for_function("FL.store.snap.session.params.secs===3")

        # student joins
        st = await ctx.new_page(); hook(st,'student')
        await st.goto(URL+'#/team/'+code)
        await st.fill('#j_code',code); await st.fill('#j_name','Sunny工廠'); await st.select_option('#j_table','20')
        await st.click('[data-act=join]')
        await st.wait_for_selector('text=已報到')
        print('student joined; K =', await st.evaluate("FL.team(FL.snap(),FL.me.team_id).present"))

        # projector
        sc = await ctx.new_page(); hook(sc,'screen')
        await sc.set_viewport_size({'width':1920,'height':1080})
        await sc.goto(URL+'#/screen/'+code)
        await sc.wait_for_selector('.screenwrap .tiles')
        await sc.screenshot(path='/tmp/shots/01_screen_lobby.png')
        await st.screenshot(path='/tmp/shots/01_student_lobby.png')

        # -> trial
        await host.click('[data-act=htab][data-tab=control]')
        await host.click('[data-act=hnext]'); await wait_phase(st,'trial')
        K = await st.evaluate("FL.team(FL.snap(),FL.me.team_id).present")
        for L in range(1,5):
            await host.click(f'[data-act=htrialL][data-lv="{L}"]')
            await host.click('[data-act=hshift]')
            await st.wait_for_function("FL.shiftState(FL.shiftOf(FL.snap())).st==='done'", timeout=15000)
            if L==1:
                await sc.screenshot(path='/tmp/shots/02_screen_trial_L1.png')
            print('trial L',L,'done; shift', await host.evaluate("JSON.stringify(FL.snap().session.shift)"), 'runs', await host.evaluate("JSON.stringify(FL.snap().runs.filter(r=>r.kind==='trial').map(r=>[r.team_id.slice(0,5),r.L,r.q,r.status]))"))
            if K>=L:
                # student verifies whoever they verify, then confirms their own
                await st.wait_for_timeout(300)
                n = await st.locator('[data-act=report]').count()
                for i in range(n):
                    await st.locator('[data-act=step][data-d="5"]').nth(i).click()
                    await st.locator('[data-act=report]').nth(i).click()
                # bots verify the student (wait for a report to arrive)
                await st.wait_for_function("(()=>{var s=FL.snap(),me=FL.me.team_id;return s.runs.some(r=>r.team_id===me&&r.kind==='trial'&&r.L===%d)})()"%L, timeout=12000)
                await st.wait_for_selector('[data-act=confirm][data-ok="1"]')
                await st.click('[data-act=confirm][data-ok="1"]')
            # wait for everyone verified
            await host.wait_for_function("(()=>{var s=FL.store.snap,L=%d;var need=s.teams.filter(t=>t.present>=L);return need.every(t=>s.runs.some(r=>r.team_id===t.id&&r.kind==='trial'&&r.L===L&&(r.status==='confirmed'||r.status==='host')))})()"%L, timeout=20000) if False else None
            await st.wait_for_timeout(500)
        await st.screenshot(path='/tmp/shots/03_student_trial_done.png')
        print('trial runs:', await st.evaluate("FL.snap().runs.filter(r=>r.kind==='trial').length"))
        # let bots finish confirming
        await host.wait_for_timeout(5000)
        await sc.screenshot(path='/tmp/shots/04_screen_trial_chart.png')
        await host.screenshot(path='/tmp/shots/04_host_trial.png')

        # -> market (recommend)
        await host.click('[data-act=hnext]'); await wait_phase(st,'market')
        await host.wait_for_timeout(400)
        await host.screenshot(path='/tmp/shots/05_host_market.png')
        recs = await host.locator('[data-act=hrec]').count(); print('recommendations:', recs)
        if recs: await host.locator('[data-act=hrec]').first.click()
        await host.wait_for_timeout(600)
        par = await host.evaluate("FL.store.snap.session.params"); print('params', par)
        await st.screenshot(path='/tmp/shots/05_student_market.png')
        await sc.screenshot(path='/tmp/shots/05_screen_market.png')

        # -> decide1
        await host.click('[data-act=hnext]'); await wait_phase(st,'decide1')
        await st.wait_for_selector('[data-act=sel1]')
        await st.screenshot(path='/tmp/shots/06_student_decide1.png', full_page=True)
        await st.locator('[data-act=sel1][data-lv="2"]').click(); await st.click('[data-act=lock1]')
        await st.wait_for_selector('text=已鎖定')
        await host.wait_for_function("(()=>{var s=FL.store.snap;return s.locked.filter(x=>x.period===1).length===s.teams.length})()", timeout=15000)
        await sc.screenshot(path='/tmp/shots/06_screen_decide1.png')
        # -> run1 (reveal)
        await host.click('[data-act=hnext]'); await wait_phase(st,'run1')
        await sc.wait_for_timeout(1500)
        await sc.screenshot(path='/tmp/shots/07_screen_run1.png')
        await host.click('[data-act=hshift]')
        await st.wait_for_function("FL.shiftState(FL.shiftOf(FL.snap())).st==='done'", timeout=15000)
        n = await st.locator('[data-act=report]').count()
        for i in range(n):
            await st.locator('[data-act=step][data-d="5"]').nth(i).click(); await st.locator('[data-act=report]').nth(i).click()
        await st.wait_for_selector('[data-act=confirm][data-ok="1"]', timeout=15000)
        await st.screenshot(path='/tmp/shots/07_student_run1.png')
        await st.click('[data-act=confirm][data-ok="1"]')
        await host.wait_for_timeout(4500)
        # -> ledger1
        await host.click('[data-act=hnext]'); await wait_phase(st,'ledger1')
        await st.wait_for_timeout(600)
        await st.screenshot(path='/tmp/shots/08_student_ledger1.png', full_page=True)
        await sc.screenshot(path='/tmp/shots/08_screen_ledger1.png')
        # -> decide2
        await host.click('[data-act=hnext]'); await wait_phase(st,'decide2')
        await st.wait_for_selector('[data-act=renew]')
        await st.click('[data-act=renew][data-v="0"]'); await st.click('[data-act=lock2]')
        await st.wait_for_selector('text=已鎖定')
        await st.screenshot(path='/tmp/shots/09_student_decide2.png', full_page=True)
        await host.wait_for_function("(()=>{var s=FL.store.snap;return s.locked.filter(x=>x.period===2).length===s.teams.length})()", timeout=15000)
        await host.click('[data-act=hnext]'); await wait_phase(st,'run2')
        await host.click('[data-act=hshift]')
        await st.wait_for_timeout(9000)
        await sc.screenshot(path='/tmp/shots/10_screen_run2.png')
        await host.click('[data-act=hnext]', timeout=5000)
        await host.wait_for_timeout(500)
        # the confirm-skip guard may need a second press
        if (await host.evaluate("FL.store.snap.session.phase"))=='run2':
            await host.click('[data-act=hnext]')
        await wait_phase(st,'ledger2')
        await st.wait_for_timeout(600)
        await st.screenshot(path='/tmp/shots/11_student_ledger2.png', full_page=True)
        await sc.screenshot(path='/tmp/shots/11_screen_ledger2.png')
        await host.click('[data-act=hnext]'); await wait_phase(st,'debrief')
        await st.wait_for_timeout(600)
        await sc.screenshot(path='/tmp/shots/12_screen_debrief.png')
        await st.screenshot(path='/tmp/shots/12_student_debrief.png', full_page=True)
        await host.click('[data-act=htab][data-tab=tools]'); await host.click('[data-act=hexport]')
        await host.wait_for_timeout(500)
        print('CSV:\n', (await host.evaluate("FL.H.csv"))[:900])
        await host.click('[data-act=htab][data-tab=teams]'); await host.screenshot(path='/tmp/shots/13_host_teams.png', full_page=True)
        print('ERRORS:', errs)
        await b.close()
asyncio.run(main())
