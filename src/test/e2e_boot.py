import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width':1280,'height':800})
        errs=[]
        for role in ['', '#/team', '#/screen', '#/host']:
            pg = await ctx.new_page()
            pg.on('console', lambda m, r=role: errs.append((r, m.type, m.text)) if m.type in ('error','warning') else None)
            pg.on('pageerror', lambda e, r=role: errs.append((r,'pageerror',str(e))))
            await pg.goto('http://localhost:8765/index.html'+role)
            await pg.wait_for_timeout(600)
            txt = (await pg.inner_text('#app'))[:120].replace('\n',' | ')
            print(repr(role), '->', txt)
        print('ERRORS:', errs)
        await b.close()
asyncio.run(main())
