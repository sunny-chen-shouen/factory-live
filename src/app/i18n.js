/* Factory LIVE — strings (zh-Hant default, English alternative). {0}, {1}… are parameters. */
window.FL = window.FL || {};
window.FL.dict = (function () {
  var D = {};
  function a(k, zh, en) { D[k] = { zh: zh, en: en }; }

  a('app_title', '工廠 LIVE', 'Factory LIVE');
  a('tagline', '為什麼今天開工，下期卻不續租？', 'Why open today, yet not renew next period?');
  a('loading', '載入中…', 'Loading…');
  a('offline', '網路不穩，畫面可能不是最新。會自動重連。', 'Connection is unstable; the screen may be out of date. Reconnecting automatically.');
  a('local_banner', '示範模式：資料只存在這台裝置的瀏覽器，同一個瀏覽器的不同分頁可以彼此同步。正式上課請接上資料庫。', 'Demo mode: data stays in this browser only; tabs of the same browser stay in sync. Connect the database for the real class.');
  a('demo_mode', '示範模式', 'Demo mode');
  a('leave', '離開', 'Leave');
  a('home_team', '我是廠長（學生）', 'I run a factory (student)');
  a('home_screen', '投影大螢幕', 'Projector screen');
  a('home_host', '教師／助教台', 'Teacher / TA console');
  a('rejoin', '重新報到', 'Join again');
  a('team_gone', '老師已把你們這組移除，請重新報到。', 'Your team was removed by the teacher. Please join again.');
  a('none', '（無）', '(none)');
  a('none_yet', '還沒有隊伍', 'No teams yet');
  a('people', '人', 'people');
  a('period', '第', 'Period ');
  a('period1', '第一期（今天）', 'Period 1 (today)');
  a('period2', '第二期（下期）', 'Period 2 (next)');
  a('enter', '進入', 'Enter');
  a('copied', '已複製', 'Copied');
  a('sure', '再按一次確認', 'Press again to confirm');

  // phases
  a('ph_lobby', '報到', 'Check-in');
  a('ph_trial', '試產', 'Trial runs');
  a('ph_market', '市場公布', 'Market');
  a('ph_decide1', '決策一：今天', 'Decide: today');
  a('ph_run1', '生產一', 'Production 1');
  a('ph_ledger1', '結帳一', 'Ledger 1');
  a('ph_decide2', '決策二：下期', 'Decide: next');
  a('ph_run2', '生產二', 'Production 2');
  a('ph_ledger2', '結帳二', 'Ledger 2');
  a('ph_debrief', '收尾', 'Debrief');

  // join
  a('join_title', '加入工廠', 'Join a factory');
  a('room_code', '房號', 'Room');
  a('team_name', '工廠名稱', 'Factory name');
  a('team_name_ph', '例如：白頭翁工廠', 'e.g. Bulbul Works');
  a('table_no', '桌號', 'Table');
  a('table_n', '桌 {0}', 'Table {0}');
  a('present_q', '今天你們這桌實到幾人？', 'How many of you are at this table?');
  a('present_hint', '含你自己，最多 4 人。這是你們最多能雇用的工人數。', 'Including you, up to 4. This is the most workers you can hire.');
  a('k_people', '{0} 人', '{0} here');
  a('join_btn', '加入', 'Join');

  // rules
  a('rules_title', '遊戲規則', 'How the game works');
  a('rule1', '你們桌是一家工廠，是價格接受者：收購價和工資由老師公布，你們不能討價還價。', 'Your table is a factory and a price taker: the buying price and wage are announced; you cannot bargain.');
  a('rule2', '每一班 20 秒。只有被雇的人可以碰橡皮筋，響鈴放手後由鄰桌數「還連在主繩上的合格環」。', 'Each shift is 20 seconds. Only hired workers touch the rings. After the bell, your neighbour counts the valid rings still on the main chain.');
  a('rule3', '工人每人要付同一份工資；沒被雇的同學負責驗收、記帳或預測。', 'Every hired worker is paid the same wage; the others verify, keep books or forecast.');
  a('rule4', '租金每期一次。第一期的租金已經付了，不管開不開工都拿不回來。', 'Rent is due once per period. Period 1 rent is already paid and cannot be recovered either way.');
  a('rule5', '得分是每期的工廠利潤：營收 − 工資 − 租金。', 'Your score is each period\'s profit: revenue − wages − rent.');

  // lobby / trial
  a('lobby_h', '已報到', 'You are in');
  a('lobby_p', '請先確認桌號和人數，等老師開場。', 'Check your table and headcount, then wait for the teacher.');
  a('trial_h', '試產', 'Trial runs');
  a('trial_wait', '等老師宣布下一班。每一班會指定上工人數 1、2、3、4。', 'Wait for the next shift. Shifts are run with 1, 2, 3, then 4 workers.');
  a('trial_wait_s', '等待下一班試產', 'Waiting for the next trial shift');
  a('trial_shift', '試產：{0} 人上工', 'Trial: {0} on the line');
  a('you_work', '請 {0} 位同學上工', 'Put {0} workers on the line');
  a('you_verify_only', '這班要 {1} 人，你們只有 {0} 人，這班只負責驗收。', 'This shift needs {1}; you only have {0}. You verify this time.');
  a('my_trial', '我們的試產紀錄', 'Our trial results');
  a('no_trial_yet', '還沒有試產紀錄。', 'No trial results yet.');
  a('c_workers', '人數', 'Workers');
  a('c_rings', '環數', 'Rings');
  a('c_status', '狀態', 'Status');
  a('c_rev', '營收', 'Revenue');
  a('c_wage', '工資', 'Wages');
  a('c_net', '營收−工資', 'Rev − wages');
  a('c_dv_short', '新增產值', 'Added value');
  a('c_mp', '邊際產量', 'Marginal');
  a('mean_q', '全班平均', 'Class mean');
  a('st_reported', '待確認', 'To confirm');
  a('st_confirmed', '已確認', 'Confirmed');
  a('st_disputed', '有爭議', 'Disputed');
  a('st_host', '老師核定', 'Set by teacher');

  // verification
  a('verify_h', '驗收：{0}（桌 {1}）', 'Verify: {0} (table {1})');
  a('verify_p', '他們這班 {0} 人上工。響鈴放手後，輕提起始環，數還連在主繩上的合格單環。', '{0} of them worked. After the bell, lift the start ring and count valid single rings still on the main chain.');
  a('verify_after', '響鈴放手後才能回報。', 'You can report after the bell.');
  a('report_btn', '送出回報', 'Send count');
  a('report_again', '更正回報', 'Send a correction');
  a('reported_n', '回報 {0} 環', 'Reported {0}');
  a('wait_neighbour', '等鄰桌數你們的環數。', 'Waiting for your neighbour to count your rings.');
  a('no_verify', '這班沒有需要你驗收的桌。', 'No table for you to verify this shift.');
  a('confirm_h', '鄰桌數了你們的環數', 'Your neighbour counted your rings');
  a('confirm_p', '鄰桌回報：{0} 環', 'Neighbour says: {0} rings');
  a('confirmed_p', '你們確認了 {0} 環。', 'You confirmed {0} rings.');
  a('confirm_ok', '確認', 'Agree');
  a('confirm_no', '有誤', 'Wrong');
  a('toast_sent', '已送出', 'Sent');
  a('toast_confirmed', '已確認', 'Confirmed');
  a('toast_disputed', '已標示有爭議，助教會來處理', 'Marked as disputed; a TA will help');
  a('toast_locked', '已鎖定', 'Locked in');
  a('toast_saved', '已儲存', 'Saved');

  // market + plan
  a('market_h', '市場條件公布', 'Market announced');
  a('p_name', '每環收購價 p', 'Price per ring p');
  a('w_name', '每人工資 w', 'Wage per worker w');
  a('f_name', '每期租金 F', 'Rent per period F');
  a('secs_name', '每班秒數', 'Seconds per shift');
  a('market_p', '條件兩期不變。今天的租金 {0} 已經付了。', 'Conditions stay fixed for both periods. Today\'s rent of {0} is already paid.');
  a('plan_h', '你們的生產計畫表', 'Your production plan');
  a('plan_note', '「多請一人」欄：多請一人增加的營收 / 要多付的工資。增收 = 價格 × 多出來的環數；增收比工資大才值得請。', '"Extra worker" = added value / wage. Added value = price × extra rings.');

  // decisions
  a('d1_h', '決策一：今天要請幾個人？', 'Decision 1: how many workers today?');
  a('d1_p', '租金 {0} 今天已付，開不開工都拿不回來。請 0 人就是停工。', 'The rent of {0} is already paid either way. Hiring 0 means closing today.');
  a('d1_q', '請幾位工人？', 'How many workers?');
  a('stop', '停工', 'Close');
  a('lock', '鎖定決策', 'Lock in');
  a('relock', '更新並鎖定', 'Update and lock');
  a('locked', '已鎖定', 'Locked');
  a('locked_note', '老師翻牌前仍可修改。', 'You can change it until the teacher flips the cards.');
  a('prev_work', '雇 {0} 人：{1} 環 → 營收 {2} − 工資 {3} − 租金 {4} = {5}', 'Hire {0}: {1} rings → revenue {2} − wages {3} − rent {4} = {5}');
  a('prev_stop', '停工：只損失已付的租金，利潤 {0}。', 'Close: you only lose the rent already paid, profit {0}.');
  a('prev_stop_cmp', '提醒：停工的利潤是 {0}。', 'Reminder: closing gives {0}.');
  a('prev_untested', '這個人數沒有試產紀錄，只能自己估計。', 'No trial data for this headcount; you are estimating.');
  a('prev_renew0', '續租但不雇人：付租金卻沒有營收，利潤 {0}。', 'Renew with no workers: pay rent, earn nothing, profit {0}.');
  a('prev_exit', '退出：不付租金，利潤 0。', 'Exit: no rent, profit 0.');
  a('d2_h', '決策二：下期要續租嗎？', 'Decision 2: renew next period?');
  a('d2_p', '假設技術、工資、售價和人力都和今天一樣。續租要再付租金 {0}；退出的利潤是 0。', 'Assume technology, wage, price and headcount are unchanged. Renewing costs another {0}; exiting earns 0.');
  a('d2_q', '續租或退出？', 'Renew or exit?');
  a('renew', '續租', 'Renew');
  a('exit', '退出', 'Exit');
  a('pay_f', '付租金 {0}', 'pay {0}');
  a('profit_0', '利潤 0', 'profit 0');
  a('d2_hire', '續租後要請幾位工人？', 'If you renew, how many workers?');
  a('pred_h', '全班預測', 'Class forecast');
  a('pred_p', '今天開工的 {0} 家工廠中，下期有幾家會退出？', 'Of the {0} factories that opened today, how many will exit next period?');
  a('thinking', '思考中', 'Thinking');

  // run
  a('run_h', '生產：第 {0} 期', 'Production: period {0}');
  a('no_decision', '你們沒有交決策，請找助教。', 'No decision was submitted; please find a TA.');
  a('you_stopped', '你們今天停工，請協助驗收。', 'You are closed this period; help verify.');
  a('you_exited', '你們已退出，請協助驗收。', 'You have exited; help verify.');
  a('cd_idle', '等待', 'Waiting');
  a('cd_pre', '準備', 'Get ready');
  a('cd_run', '開工！', 'Go!');
  a('cd_done', '放手！', 'Hands off!');
  a('cd_done_l', '全員放手，等驗收', 'Everyone let go; wait for the count');

  // ledger
  a('ledger_h', '結帳：第 {0} 期', 'Ledger: period {0}');
  a('ledger_pending', '等鄰桌驗收和你們確認後，這裡會顯示帳本。', 'The ledger appears once your neighbour counts and you confirm.');
  a('l_rings', '合格環數', 'Valid rings');
  a('l_rev', '營收（{0} × 環數）', 'Revenue ({0} × rings)');
  a('l_wage', '工資（{0} × {1} 人）', 'Wages ({0} × {1})');
  a('l_rent', '租金', 'Rent');
  a('l_profit', '利潤', 'Profit');
  a('l_exit', '退出：不付租金', 'Exited: no rent');
  a('l_decision', '決策', 'Decision');
  a('l_alt', '另一個選項', 'The alternative');
  a('hire_n', '雇 {0} 人', 'Hire {0}');
  a('cmp1_exact', '今天開工利潤 {0}；若停工是 {1}。開工比停工好 {2}。', 'Open today: {0}. Closing would have been {1}. Opening was better by {2}.');
  a('cmp1_est', '你們今天停工，利潤 {0}。若雇最佳人數，估計 {1}。', 'You closed: {0}. With the best headcount, roughly {1}.');
  a('cmp2_exact', '續租利潤 {0}；若退出是 {1}。', 'Renewed: {0}. Exiting would have been {1}.');
  a('cmp2_est', '你們退出，利潤 {0}。若續租並雇最佳人數，估計 {1}。', 'You exited: {0}. Renewing with the best headcount, roughly {1}.');
  a('est_note', '標星號或「估計」的數字是用試產資料推算，不是實際生產的結果。', 'Starred or "estimated" figures come from trial data, not an actual run.');
  a('total_h', '兩期合計', 'Two-period total');
  a('pred_result', '你們預測 {0} 家會退出，實際是 {1} 家。', 'You predicted {0} exits; the actual number was {1}.');

  // debrief
  a('debrief_h', '離場單', 'Exit slip');
  a('slip_h', '寫下你的理由', 'Write your reasons');
  a('slip_q', '今天的租金 {0} 已付。若下期條件都相同、租約可以不簽，為什麼今天開工，下期卻可以退出？', 'Today\'s rent of {0} is already paid. If next period is identical and the lease is optional, why open today yet exit next?');
  a('slip_1', '今天我們開工（或停工），因為……', 'Today we opened (or closed) because…');
  a('slip_2', '下一期我們續租（或退出），因為……', 'Next period we renew (or exit) because…');

  // projector
  a('screen_title', '投影大螢幕', 'Projector screen');
  a('sound_on', '啟用聲音', 'Enable sound');
  a('scan_join', '掃碼加入', 'Scan to join');
  a('joined_h', '已報到 {0} 家工廠 · {1} 人', '{0} factories · {1} people');
  a('tested_n', '已試產 {0} 檔', '{0} tested');
  a('k_short', '人數不足', 'Too few');
  a('rings', '環', 'rings');
  a('open_n', '開工 {0} 人', 'Open · {0}');
  a('renew_n', '續租 · {0} 人', 'Renew · {0}');
  a('no_dec_short', '未交', 'No entry');
  a('verified_progress', '已驗收', 'Verified');
  a('chart_alt', '各組的人數與產量，粗線為全班平均', 'Workers vs rings per team; thick line is the class mean');
  a('chart_h', '每組的試產結果（粗線＝全班平均）', 'Trial results per team (thick = class mean)');
  a('market_screen_p', '兩期條件相同。今天的租金已付：它不會因為你開工或停工而改變。', 'Same conditions for both periods. Today\'s rent is already paid: it does not change whether you open or close.');
  a('screen_marginal', '多請一人，值不值得？', 'Is one more worker worth it?');
  a('d1_screen', '決策一：今天要請幾個人？', 'Decision 1: how many workers today?');
  a('d1_screen_p', '租金 {0} 已付。請 0 人就是停工。', 'Rent {0} is paid. Hiring 0 means closing.');
  a('d2_screen', '決策二：下期續租還是退出？', 'Decision 2: renew or exit?');
  a('d2_screen_p', '條件不變。續租要再付 {0}；退出利潤是 0。', 'Nothing changes. Renewing costs {0} more; exiting earns 0.');
  a('submitted', '已鎖定決策', 'Decisions locked');
  a('run_screen', '第 {0} 期生產', 'Production · period {0}');
  a('s_open', '開工', 'Open');
  a('s_stop', '停工', 'Closed');
  a('s_renew', '續租', 'Renewed');
  a('s_exit', '退出', 'Exited');
  a('s_open_then_exit', '今天開工、下期退出', 'Opened today, exit next');
  a('no_featured', '請老師在教師台選一家工廠上台說明。', 'Pick a factory in the teacher console to present.');
  a('feat1_open', '{0} 今天雇 {1} 人，利潤 {2}；如果停工會是 {3}。', '{0} hired {1} today for a profit of {2}; closing would have been {3}.');
  a('feat1_stop', '{0} 今天停工，利潤 {1}。', '{0} closed today with a profit of {1}.');
  a('feat2_renew', '{0} 續租，利潤 {1}。', '{0} renewed with a profit of {1}.');
  a('feat2_exit', '{0}：今天開工（利潤 {1}），下期退出。最好的方案只能賺回 {2} 的營收扣工資，付不起 {3} 的租金。', '{0}: opened today (profit {1}) but exits next. Its best plan earns only {2} after wages, which cannot cover rent of {3}.');
  a('debrief_screen', '今天開工、下期退出的工廠：{0}。租金 {1} 已付時要不要開工，和租金能否避免時要不要續租，是兩個不同的問題。', 'Opened today, exiting next: {0}. Whether to open once rent of {1} is paid and whether to renew when rent is avoidable are different questions.');
  a('pred_vs_actual', '全班預測 vs 實際退出家數', 'Class forecast vs actual exits');
  a('pred_note', '▲ 為實際家數', '▲ marks the actual number');

  // host
  a('h_console', '教師台', 'Teacher console');
  a('h_create', '建立新場次', 'Create a session');
  a('h_create_p', '設定一組教師密碼（至少 6 個字元）。助教用同一組密碼進入。', 'Choose a teacher password (6+ characters). TAs use the same one to get in.');
  a('h_key', '教師密碼', 'Teacher password');
  a('h_key_ph', '至少 6 個字元', 'At least 6 characters');
  a('h_create_btn', '建立並進入', 'Create and enter');
  a('h_resume', '回到既有場次', 'Resume a session');
  a('h_resume_btn', '進入', 'Enter');
  a('prev', '上一步', 'Back');
  a('next_to', '下一步：{0}', 'Next: {0}');
  a('end', '已是最後一步', 'Last step');
  a('confirm_skip', '還有 {0} 組沒完成，仍要繼續？再按一次', '{0} teams not done. Continue anyway? Press again');
  a('tab_control', '控制', 'Control');
  a('tab_teams', '隊伍與數據', 'Teams and data');
  a('tab_params', '參數', 'Parameters');
  a('tab_tools', '工具', 'Tools');
  a('links_h', '連結', 'Links');
  a('link_join', '學生報到', 'Student join');
  a('link_screen', '投影畫面', 'Projector');
  a('copy_join', '複製報到連結', 'Copy join link');
  a('open_screen', '開投影畫面', 'Open projector');
  a('class_h', '全班', 'Class');
  a('stats_teams', '{0} 家工廠，共 {1} 人', '{0} factories, {1} people');
  a('waiting_for', '還在等', 'Waiting for');
  a('teams_in', '已報到的工廠', 'Factories checked in');
  a('all_in', '全部到齊。', 'Everyone is in.');
  a('trial_pick', '這一班試產幾人？', 'Workers for this trial shift');
  a('done_n', '已驗收 {0}', '{0} verified');
  a('start_shift', '開始 {0} 秒班次', 'Start {0}-second shift');
  a('restart_shift', '重新開始班次', 'Restart shift');
  a('clear_shift', '清除班次', 'Clear shift');
  a('run_shift', '生產班次', 'Production shift');
  a('enter_for', '代登', 'Enter');
  a('set_final', '定案', 'Set final');
  a('disputes_h', '有爭議的回報', 'Disputed counts');
  a('feat_h', '選一家工廠上台說明', 'Pick a factory to present');
  a('auto_pick', '自動挑選', 'Pick automatically');
  a('feat_note', '★ 表示「今天開工、下期退出」的工廠。', '★ marks a factory that opened today and exits next.');
  a('export_h', '匯出', 'Export');
  a('export_csv', '匯出 CSV', 'Export CSV');
  a('params_locked', '決策開始後參數已鎖定。要修改請先回到「市場公布」。', 'Parameters are locked once decisions begin. Go back to Market to change them.');
  a('rec_h', '參數建議', 'Parameter suggestions');
  a('rec_note', '用目前試產資料，找出讓最多工廠落在「開工有利但不值得續租」(0 &lt; G &lt; F) 的 p、w、F。G = 最佳人數的營收扣工資。', 'From the trial data: p, w, F that put most factories in "worth opening, not worth renewing" (0 &lt; G &lt; F). G = best revenue after wages.');
  a('rec_need', '至少要有兩家工廠、各兩個人數的試產資料才能建議。', 'Needs at least two factories with two trial headcounts each.');
  a('rec_line', '{0}/{1} 家的 G 介於 0 與 F 之間；{2} 家 G≥F；{3} 家 G≤0', '{0}/{1} with G between 0 and F; {2} with G≥F; {3} with G≤0');
  a('apply', '套用', 'Apply');
  a('g_h', '目前參數（p={0}, w={1}, F={2}）下各家的 G', 'G per factory at p={0}, w={1}, F={2}');
  a('g_summary', '開工有利但不值得續租 {0} 家；值得續租 {1} 家；停工 {2} 家', 'Open-but-not-renew: {0}; renew: {1}; stay shut: {2}');
  a('cls_aha', '開工有利、不值得續租', 'Open, not renew');
  a('cls_renew', '值得續租', 'Renew');
  a('cls_stop', '停工', 'Shut');
  a('del', '移除', 'Remove');
  a('teams_note', '改任何格子都會立即更新所有人。橘色？表示待確認，！表示有爭議。', 'Edits update everyone immediately. ? = awaiting confirmation, ! = disputed.');
  a('bots_h', '模擬隊伍（彩排用）', 'Rehearsal bots');
  a('bots_p', '新增會自己試產、決策、驗收的假隊伍，讓你一個人也能完整跑一遍。', 'Adds fake teams that trial, decide and verify on their own so you can rehearse alone.');
  a('bots_added', '已新增 {0} 組', 'Added {0}');
  a('bots_clear', '移除模擬隊伍（{0}）', 'Remove bots ({0})');
  a('reset_h', '重置', 'Reset');
  a('reset_p', '清除試產：只刪除試產紀錄。清除全部成績：回到報到，保留隊伍。全部重來：連隊伍一起刪除。', 'Clear trials deletes trial data only. Clear results returns to check-in and keeps teams. Start over also removes teams.');
  a('reset_trial', '清除試產', 'Clear trials');
  a('reset_runs', '清除全部成績', 'Clear results');
  a('reset_all', '全部重來', 'Start over');

  // host tips per phase
  a('tip_lobby', '等各桌掃碼報到並確認人數。到齊後按「下一步：試產」。', 'Wait for tables to join and confirm headcount, then go to Trial.');
  a('tip_trial', '依序測 1、2、3、4 人：選人數 → 開始班次 → 響鈴後鄰桌回報、本桌確認。', 'Test 1, 2, 3, 4 workers: pick headcount → start shift → neighbours report after the bell → tables confirm.');
  a('tip_market', '看「參數建議」，選定 p、w、F 後公布。公布後兩期都不再改。', 'Check the suggestions, pick p, w, F and announce. They do not change after this.');
  a('tip_decide1', '學生密選今天要請幾人。全部鎖定後再進入生產，系統會同時翻牌。', 'Students privately pick today\'s headcount. Once all are locked, move on: the cards flip together.');
  a('tip_run1', '已翻牌。開始班次，響鈴後鄰桌驗收、本桌確認。', 'Cards are revealed. Start the shift; neighbours count and tables confirm.');
  a('tip_ledger1', '挑一家「開工但仍虧損」的工廠，請他比較開工與停工。', 'Pick a factory that opened and still lost money; compare open vs closed.');
  a('tip_decide2', '學生密選續租或退出，並預測「今天開工的工廠有幾家會退出」。', 'Students privately pick renew or exit and forecast how many open factories will exit.');
  a('tip_run2', '續租的工廠生產，退出的工廠協助驗收。', 'Renewing factories produce; exited ones help verify.');
  a('tip_ledger2', '挑一家★工廠（今天開工、下期退出）請他說兩句話。', 'Pick a ★ factory (opened today, exits next) and ask for the two-sentence explanation.');
  a('tip_debrief', '收離場單。可匯出 CSV 留作課後講解。', 'Collect the exit slips. Export the CSV for follow-up.');

  // errors
  a('err_generic', '發生錯誤', 'Something went wrong');
  a('err_bad_host_key', '教師密碼不正確', 'Wrong teacher password');
  a('err_bad_team_token', '身分驗證失敗，請重新報到', 'Identity check failed; please join again');
  a('err_no_session', '找不到這個房號', 'Room not found');
  a('err_table_taken', '這一桌已經有別的隊伍名稱', 'That table already has a different team name');
  a('err_bad_name', '請輸入工廠名稱（24 字以內）', 'Enter a factory name (max 24 characters)');
  a('err_locked_phase', '現在不能修改人數', 'Headcount cannot be changed now');
  a('err_not_deciding', '現在不是決策時間', 'Not the decision phase');
  a('err_not_in_phase', '現在不是這個階段', 'Not available in this phase');
  a('err_bad_l', '人數不符', 'That headcount is not allowed');
  a('err_bad_q', '環數不合理', 'That ring count is not valid');
  a('err_self_report', '不能驗收自己', 'You cannot verify yourself');
  a('err_not_producing', '這一桌這期沒有生產', 'That table is not producing this period');
  a('err_key_too_short', '密碼至少 6 個字元', 'Password needs 6+ characters');
  a('err_wrong_session', '不是同一個場次', 'Different session');
  a('err_bad_present', '人數要在 0 到 4 之間', 'Headcount must be 0–4');
  a('err_bad_predict', '預測數字不合理', 'Forecast is not valid');
  a('p_s', '收購價 p', 'Price p');
  a('w_s', '工資 w', 'Wage w');
  a('f_s', '租金 F', 'Rent F');
  a('c_dv1', '多請一人', '+1 worker');
  a('c_dv2', '增收 / 工資', 'added rev / wage');
  a('or_type_code', '或輸入房號', 'or enter the room code');
  a('lobby_wait', '等第一組工廠報到…', 'Waiting for the first factory…');
  a('peek_prev', '看上一階段：{0}', 'Look back: {0}');
  a('peek_back', '回到目前階段', 'Back to now');
  a('peek_note', '這是上一階段「{0}」的內容（唯讀），目前進行的階段不受影響。', 'Read-only view of the earlier step “{0}”. The live step is unchanged.');
  a('back_home', '回首頁', 'Home');
  return D;
})();
