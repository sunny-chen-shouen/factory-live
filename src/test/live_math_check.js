const fs = require('fs'), assert = require('node:assert/strict'), C = require('../app/calc.js');
const fixture = JSON.parse(fs.readFileSync('test/.live_qa.json','utf8'));
fixture.snapshot.teams.forEach((tm,i) => {
 const led = C.ledger(tm,fixture.snapshot), a = led.periods[1], b = led.periods[2];
 assert.deepEqual([a.profit,a.counterfactual,b.profit,b.counterfactual],fixture.expected[i]);
 console.log(tm.name, JSON.stringify({period1:a.profit,alternative1:a.counterfactual,period2:b.profit,alternative2:b.counterfactual,total:led.total}));
});
console.log('PASS: live persisted data matches three independently specified two-period calculations');
