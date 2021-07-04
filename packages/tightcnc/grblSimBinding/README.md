# `@dianlight/grblSimBinding`

> A RawSocket Binding for GrblSim.

## Usage

```
import GrblSimBinding from '@dianlight/grblsimbinding';

new SerialPort("grblsim://<path to grbl_sim.exe>", {
    binding:GrblSimBinding 
}, (err) => {});
  
```
