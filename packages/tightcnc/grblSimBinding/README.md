# Package `@dianlight/grblSimBinding`

> A RawSocket Binding for GrblSim.

## Usage

```Typescript
import GrblSimBinding from '@dianlight/grblsimbinding';

new SerialPort("grblsim://<path to grbl_sim.exe>", {
    binding:GrblSimBinding 
}, (err) => {});
  
```
