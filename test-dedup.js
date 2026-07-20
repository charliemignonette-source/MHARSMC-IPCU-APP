const arr = [ {id: 1}, {id: 2}, {id: 1} ];
const unique = [];
const seen = new Set();
for (const item of arr) {
  if (!seen.has(item.id)) {
    seen.add(item.id);
    unique.push(item);
  }
}
console.log(unique);
