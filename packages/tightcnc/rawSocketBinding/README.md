# `@dianlight/serialportRawSocketBinding`

> A RawSocket Binding for serialport.

## Usage

```Typescript
import SerialportRawSocketBinding from '@dianlight/serialportrawsocketbinding';

new SerialPort("socket://<server>:<port>", {
    binding:SerialportRawSocketBinding 
}, (err) => {});
  
```
