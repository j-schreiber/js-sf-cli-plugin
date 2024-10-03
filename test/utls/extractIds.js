import fs from 'node:fs';
let users = JSON.parse(fs.readFileSync('exports/us-export-test-plan/User/1.json', 'utf-8'));
let userIds = [];
users.records.forEach(user => { userIds.push(`'${user.Id}'`)});
console.log(userIds.join(','));