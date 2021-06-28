import * as THREE from 'three';
//import {Text} from 'troika-three-text'

export class MachineSurface extends THREE.Line {

    constructor(private machineSurface: number[]) {
        super()
        const path = new THREE.Path();
        path.lineTo(this.machineSurface[0],0)
        path.lineTo(this.machineSurface[0],this.machineSurface[1])
        path.lineTo(0,this.machineSurface[1])
        path.lineTo(0, 0)

        let currentY = 0,currentX = this.machineSurface[0];
        for(let x = 10; x < this.machineSurface[0]; x+=10){
            path.moveTo(x, currentY)
            currentY = currentY == 0?this.machineSurface[1]:0  
            path.lineTo(x, currentY)
            currentX=x
        }
        path.lineTo(currentX, 10)
        currentX = this.machineSurface[0]
        for(let y = 10; y < this.machineSurface[1]; y+=10){
            path.moveTo(currentX, y)
            currentX = currentX == 0?this.machineSurface[0]:0  
            path.lineTo(currentX,y)
        }
            
        this.geometry = new THREE.BufferGeometry().setFromPoints(path.getPoints())
        this.material = new THREE.LineBasicMaterial({ color: 0xA0A0A0 })
    }

    move(position?: number[]) {
        if(position){
            this.position.x = -position[0]
            this.position.y = -position[1]
            this.position.z = -position[2]
        }        
    }

    
}