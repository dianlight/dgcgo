//import 'tightcnc'

const ctx: Worker = self as unknown as Worker;

// Post data to parent thread
ctx.postMessage({ foo: 'foo' });

// Respond to message from parent thread
ctx.addEventListener('message', (event) => console.log(event));

while (1) {
    console.log('Messaggio out')
    console.error('Messaggio error')
}
