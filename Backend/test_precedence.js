const record = { id: 'OLD', label: 'OrderItem', data: 'stuff' };
const sid = 'NEW_ID';
const label = 'Has Item';

const element = { data: { ...record, id: sid, label } };
console.log(JSON.stringify(element, null, 2));

if (element.data.label === 'Has Item' && element.data.id === 'NEW_ID') {
    console.log("SUCCESS: Precedence works as expected.");
} else {
    console.log("FAILURE: Precedence is NOT working as expected.");
}
