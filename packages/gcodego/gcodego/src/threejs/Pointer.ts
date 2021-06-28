
import * as THREE from 'three';

export class Pointer extends THREE.ArrowHelper {

    constructor(color:THREE.Color, private size:number) {
        super(
          new THREE.Vector3(0,0,-1), // Direction
          new THREE.Vector3(0,0,0),  // Position
          size, // Length
          color,//0xFFFF30, // color
          size*0.2,// head Length
          size*0.2// head Width
          );
        (this.line.material as THREE.Material).visible = false;
        (this.cone.material as THREE.MeshBasicMaterial).visible = false;
        (this.cone.material as THREE.MeshBasicMaterial).opacity = 0.9;
    }

    move(position?: number[]) {
        if(position){
            (this.line.material as THREE.Material).visible = true;
            (this.cone.material as THREE.MeshBasicMaterial).visible = true;
            this.position.x = position[0]
            this.position.y = position[1]
            this.position.z = position[2]+this.size
          } else {
            (this.line.material as THREE.Material).visible = false;
            (this.cone.material as THREE.MeshBasicMaterial).visible = false;
          }        
    }
}