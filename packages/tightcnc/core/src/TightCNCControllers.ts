import { TightCNCTinyGConfig } from './TightCNCTinyGConfig';
import { TightCNCGrblConfig } from './TightCNCGrblConfig';


export type TightCNCControllers = {
    TinyG?: TightCNCTinyGConfig;
    grbl?: TightCNCGrblConfig;
};
