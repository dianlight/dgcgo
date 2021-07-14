<template>
    <div class='col-10'
      id="container"
      ref="container"
    />
    <div v-if="totalframes > 0" class='col self-start' style="margin-left:-3em;">
      <q-slider :style="`height:${chight}px`"

          :min="0"
          :max="totalframes"
          :step="1"
          color="green"
          vertical
          reverse
          snap
          dense
          markers
          @change="changeFrame"
      />
    </div>
    <div class="row control">
      <q-btn-group outline>
        <q-btn outline icon="photo_camera_front" @click="front">
          <q-tooltip>Front</q-tooltip>
        </q-btn>  
        <q-btn outline icon="photo_camera_back" @click="back">
          <q-tooltip>Back</q-tooltip>
        </q-btn>  
        <q-btn outline icon="filter_center_focus" @click="up">
          <q-tooltip>Up</q-tooltip>
        </q-btn>  
        <q-btn outline icon="center_focus_weak" @click="down">
          <q-tooltip>Down</q-tooltip>
        </q-btn>  
        <q-btn outline icon="switch_left" @click="left">
          <q-tooltip>Left</q-tooltip>
        </q-btn>  
        <q-btn outline icon="switch_right" @click="right">
          <q-tooltip>Right</q-tooltip>
        </q-btn>  
      </q-btn-group>
      <slot></slot>    
      <!--p _class="infobox"> {{ camera?.matrix }} </!--p-->
    </div> 
</template>

<script lang="ts">

import  * as THREE from 'three';
import CameraControls from 'camera-controls';
import Toolpath, { Modal, Position, LoadEventData } from 'gcode-toolpath';
import colornames from 'colornames';
import { dom,QSlider,QBtn, QBtnGroup, QTooltip } from 'quasar'
import { Options, Vue } from 'vue-class-component';
import split2 from 'split2'
import through2 from 'through2'
import { MachineSurface } from '../threejs/MachineSurface'
import { Pointer } from '../threejs/Pointer'
import * as _ from 'lodash'

class Props {
    gcgrid?:boolean
    darkMode?:boolean
    gcode?:string
    currentLine?:number
    cursorPosition?:number[]
    machineSurface?:number[]
    machineOffset?:number[]
    homeDirection?:('+'|'-')[]
}

class MotionColor {

    G0 = new THREE.Color(colornames('green'))
    G1 = new THREE.Color(colornames('blue'))
    G2 = new THREE.Color(colornames('deepskyblue'))
    G3 = new THREE.Color(colornames('deepskyblue'))
    CURRENT = new THREE.Color(colornames('red'))
    NEXT = new THREE.Color(colornames('grey'))
    POINTER = new THREE.Color(colornames('purple'))

    constructor(private _darkMode:boolean){
    }

    set darkMode(value: boolean){
      this._darkMode = value;
      //console.log('Darkmode is',this._darkMode)
      if(this._darkMode){
        this.G0 = new THREE.Color(colornames('lightgreen'))
        this.G1 = new THREE.Color(colornames('lightblue'))
        this.G2 = new THREE.Color(colornames('cyan'))
        this.G3 = new THREE.Color(colornames('cyan'))
      } else {
        this.G0 = new THREE.Color(colornames('green'))
        this.G1 = new THREE.Color(colornames('blue'))
        this.G2 = new THREE.Color(colornames('deepskyblue'))
        this.G3 = new THREE.Color(colornames('deepskyblue'))
      }
    }
    

     'G38.2' = undefined
     'G38.3' = undefined
     'G38.4' = undefined
     'G38.5' = undefined
     'G80' = undefined
}

@Options({
  components: { QSlider,QBtn,QBtnGroup, QTooltip },
  name:'q-3d-viewer',
  watch: {
    gcode(newData: string, oldData: string) {
     if (newData != oldData) {
        (this as Q3DViewer).reload = true;
      }
    },
    darkMode(newData:boolean, oldData:boolean){
      if(newData != oldData){
        (this as Q3DViewer).render3d()
      }
    },
    currentLine(newData:number, oldData:number){
      if(newData != oldData){   
        (this as Q3DViewer).changeLine(newData)
      }
    },
    cursorPosition(newData?:number[],oldData?:number[]){
      if(_.difference(newData,oldData||[]).length > 0){
        (this as Q3DViewer).pointer?.move(newData);
//        (this as Q3DViewer).reload = true;
        (this as Q3DViewer).render3d()
      }
    },
    machineSurface(newData?:number[],oldData?:number[]){
      if(newData && _.difference(newData,oldData||[]).length > 0){
        (this as Q3DViewer).surface = new MachineSurface(newData);
        (this as Q3DViewer).reload = true;
//        (this as Q3DViewer).render3d()
      }
    },
    machineOffset(newData?:number[],oldData?:number[]){
      if(newData && _.difference(newData,oldData||[]).length > 0){
        const self = this as Q3DViewer

        const hdata = newData.slice()
        if(self.homeDirection && self.machineSurface){
          for(let index = 0; index < hdata.length; index++){
            hdata[index]+=self.homeDirection[index] === '+'?self.machineSurface[index]:0 
          }
        }
        self.surface?.move(hdata);
        self.reload = true;
//        (this as Q3DViewer).render3d()
      }
    }
    
  },
  emits: {
    onprogress: null
  }
})
export default class Q3DViewer extends Vue.with(Props) {

  declare $refs: {
    container: HTMLDivElement
  }

  defaultColor = new THREE.Color(colornames('lightgrey'));

  currentframe = Number.MAX_VALUE;
  totalframes = 0;
  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
  workpiece?: THREE.Line; //THREE.Object3D;
  surface?: MachineSurface;
  controls?: CameraControls;
  pointer?: Pointer
  width = 0
  height = 0

  motionColor = new MotionColor(false)

  reload = true
  space ={ start: { x: 0, y: 0 }, stop: { x: 0, y: 0 } }
  chight = 10


  override created(){
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer();
    this.camera = new THREE.PerspectiveCamera(
      50,
      1,
      0.1,
      1000
    );
    CameraControls.install( { THREE: THREE } );
    if(this.machineSurface)this.surface = new MachineSurface(this.machineSurface)
    this.pointer=new Pointer(this.motionColor.POINTER,10)
  }
  

  override mounted() {
    this.init();
    this.chight = dom.height(this.$refs.container) 
    //console.log(dom.height(this.$refs.container))
    //this.animate();
  }

  override updated(): void {
    this.motionColor.darkMode = this.darkMode || false
    //  console.log("GCODE UPDATE EVENT!", this.gcodedata, this.reload);
    if (!this.gcode && this.reload) {
      this.reload = false;
      this.scene?.clear()
      if(this.surface && this.machineSurface){
        this.scene?.add(this.surface)
        if(this.controls && this.camera){
          this.controls.setLookAt( this.machineSurface[0] / 2,this.machineSurface[1] / 2,this.machineSurface[0] * 1.3,this.machineSurface[0] / 2,this.machineSurface[1] / 2,0)
          this.controls.fitToBox( this.surface, true )
        }  
      }   
      if(this.pointer)this.scene?.add(this.pointer) 
      this.pointer?.move(this.cursorPosition);
      this.render3d()
    } else if (this.gcode && this.reload) {
      this.$emit('onprogress',0)
      this.reload = false;

      const vertices:Array<THREE.Vector3> = [] 
      const colors:Array<THREE.Color> = []
      const evLine:Array<{ line: string, ln?:number}> = []

      let cevent: { line: string, ln?:number};

      const toolPath = new Toolpath({
        position: [0, 0, 0],
        modal: {
          distance: 'G90',
        },
        addLine: (modal: Modal,p1: Position,p2: Position) => {
          //console.log('->L')
          const color = modal.motion? this.motionColor[modal.motion] || this.defaultColor: this.defaultColor;
          vertices.push(new THREE.Vector3(p2.x, p2.y, p2.z));
          colors.push(color);
          //console.log('-L->',cevent)
          evLine.push(cevent)
        },
        addArcCurve: (modal: Modal, v1: Position , v2: Position , v0: Position ) => {
           const { motion, plane } = modal;
                const isClockwise = (motion === 'G2');
                const radius = Math.sqrt(
                    ((v1.x - v0.x) ** 2) + ((v1.y - v0.y) ** 2)
                );
                const startAngle = Math.atan2(v1.y - v0.y, v1.x - v0.x);
                let endAngle = Math.atan2(v2.y - v0.y, v2.x - v0.x);

                // Draw full circle if startAngle and endAngle are both zero
                if (startAngle === endAngle) {
                    endAngle += (2 * Math.PI);
                }

                const arcCurve = new THREE.ArcCurve(
                    v0.x, // aX
                    v0.y, // aY
                    radius, // aRadius
                    startAngle, // aStartAngle
                    endAngle, // aEndAngle
                    isClockwise // isClockwise
                );
                const divisions = 30;
                const points = arcCurve.getPoints(divisions);
                const color = motion? this.motionColor[motion] || this.defaultColor : this.defaultColor;

                //console.log('-C->',cevent)
                for (let i = 0; i < points.length; ++i) {
                    const point = points[i];
                    const z = ((v2.z - v1.z) / points.length) * i + v1.z;

                    if (plane === 'G17') { // XY-plane
                        vertices.push(new THREE.Vector3(point.x, point.y, z));
                    } else if (plane === 'G18') { // ZX-plane
                        vertices.push(new THREE.Vector3(point.y, z, point.x));
                    } else if (plane === 'G19') { // YZ-plane
                        vertices.push(new THREE.Vector3(z, point.x, point.y));
                    }
                    colors.push(color);
                    evLine.push(cevent)
                }
        },
      });
    

      let currentLine = 0;
      const writer = split2()
      const rewriter = through2((chunk:Buffer,enc,cb)=>{
        const line = chunk.toLocaleString()
    //    console.log('Pr->',line) 
        cevent={
          line,
          ln: currentLine
        }
        if(line.startsWith('N') || line.startsWith('n')){  
          cb(undefined,line.replace(/^[Nn]\d+/,`N${currentLine}`)+'\n')
        } else {
          cb(undefined,`N${currentLine}${line}\n`)
        }
      })

      writer.on('data', (obj:string) => {
        //console.log('@@@@',obj)
        currentLine++
        rewriter.write(obj)
          //each chunk now is a js object
      }).on('end', ()=>{
        rewriter.end()
      } )



      let consumedGcode = 0;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      toolPath.loadFromStream(rewriter, (err: unknown, _data: string) => {
            if(err)console.error(err)
            this.totalframes = vertices.length-1
      })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .on('data',(event: { line: string, words: Array<string|number>, ln?:number})=>{
          if(this.gcode){
            consumedGcode+= event.line.length+1;
            this.$emit('onprogress', consumedGcode / this.gcode.length)
       //     console.log('END->',currentLine,consumedGcode,this.gcode.length,event)
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .on('end',(_event: LoadEventData[])=>{
            this.scene?.clear()

            this.workpiece = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({
                    color: this.defaultColor,
                    linewidth: 1,
                    vertexColors: true, // THREE.VertexColors,
                    opacity: 0.8,
                    transparent: true
                })
            );

            this.scene?.add(this.workpiece);

            // Cursor
            if(this.pointer)this.scene?.add(this.pointer) 
            if(this.surface)this.scene?.add(this.surface)

            this.workpiece.geometry.setFromPoints(vertices.slice());
            this.workpiece.geometry.setAttribute( 'org_color', new THREE.BufferAttribute(
              new Float32Array(
                colors.map( color=>[ color.r, color.g, color.b ]).flat()
              ),3))
            //console.log(evLine);  
            this.workpiece.geometry.setAttribute( 'line', new THREE.BufferAttribute(
              new Int32Array(evLine.map(ev=>{
                //console.log(':',ev)
                return ev.ln||0
              })),1))

            this.workpiece.geometry.computeBoundingBox()
            if(this.workpiece.geometry.boundingBox){
              const bbox = this.workpiece.geometry.boundingBox;
              this.width = (bbox.max.x - bbox.min.x)
              this.height = (bbox.max.y - bbox.min.y)

              if (this.gcgrid) {
                const axesHelper = new THREE.AxesHelper();
                (axesHelper.material as THREE.Material).depthTest = false;
                this.scene?.add(axesHelper);   

                const gridHelper = new THREE.GridHelper(
                  Math.max(this.width, this.height),
                  Math.max(this.width, this.height) / 10
                );
                gridHelper.rotateX(Math.PI / 2);
                gridHelper.position.y = (this.height - 10) / 2;
                gridHelper.position.x = (this.width - 10) / 2;
                gridHelper.position.z = 0;
                this.scene?.add(gridHelper);
              }

              if(this.controls && this.camera){
                this.controls.setLookAt((this.width) / 2,(this.height) / 2,(this.width) * 1.3,(this.width) / 2,(this.height) / 2,0)
                this.controls.fitToBox( this.workpiece, true )
              }
            }

            this.changeFrame()
            this.$emit('onprogress',100)


        })
      writer.write(this.gcode)
      writer.end()
      writer.destroy()
    }
  }

    front(){
      const DEG90 = Math.PI * 0.5;
      if(this.controls && this.camera){
        this.controls.rotateTo( 0, DEG90, true );
        if(this.workpiece){
          this.controls.fitToBox( this.workpiece as THREE.Object3D, true )
        } else {
          this.controls.fitToBox( this.surface as THREE.Object3D, true )
        }
      }
    }

    back(){
      const DEG90 = Math.PI * 0.5;
      const DEG180 = Math.PI;
      if(this.controls && this.camera){
        this.controls.rotateTo( DEG180, DEG90, true );
        if(this.workpiece){
          this.controls.fitToBox( this.workpiece as THREE.Object3D, true )
        } else {
          this.controls.fitToBox( this.surface as THREE.Object3D, true )
        }
      }

    }

    up(){
      if(this.controls && this.camera){
        this.controls.rotateTo( 0, 0, true );
        if(this.workpiece){
          this.controls.fitToBox( this.workpiece as THREE.Object3D, true )
        } else {
          this.controls.fitToBox( this.surface as THREE.Object3D, true )
        }
      }

    }

    down(){
      const DEG180 = Math.PI;
      if(this.controls && this.camera){
        this.controls.rotateTo( 0, DEG180, true );
        if(this.workpiece){
          this.controls.fitToBox( this.workpiece as THREE.Object3D, true )
        } else {
          this.controls.fitToBox( this.surface as THREE.Object3D, true )
        }
      }

    }

    right(){
      const DEG90 = Math.PI * 0.5;
      if(this.controls && this.camera){
        this.controls.rotateTo( DEG90, DEG90, true );
        if(this.workpiece){
          this.controls.fitToBox( this.workpiece as THREE.Object3D, true )
        } else {
          this.controls.fitToBox( this.surface as THREE.Object3D, true )
        }
      }

    }

    left(){
      const DEG90 = Math.PI * 0.5;
      if(this.controls && this.camera){
        this.controls.rotateTo( -DEG90, DEG90, true );
        if(this.workpiece){
          this.controls.fitToBox( this.workpiece as THREE.Object3D, true )
        } else {
          this.controls.fitToBox( this.surface as THREE.Object3D, true )
        }
      }

    }

    init(): void {
      if(this.scene){
        this.scene.background = new THREE.Color(!this.darkMode?'white':'black');
    
        if(this.surface){
          this.scene?.add(this.surface)
        }
      }    

      this.renderer?.setPixelRatio(window.devicePixelRatio);
      this.$refs.container?.appendChild(this.renderer?.domElement as Node);
      this.controls = new CameraControls( this.camera as THREE.PerspectiveCamera, this.renderer?.domElement as HTMLCanvasElement);

      if(this.controls){
        this.controls.minDistance = -500;
        this.controls.maxDistance = 500;
      }

      // Animation
      const clock = new THREE.Clock();
      const anim = ()=>{
        const delta = clock.getDelta();
        const updated = this.controls?.update( delta );

        requestAnimationFrame( anim );

        if ( updated ) {

          this.renderer?.render( this.scene as THREE.Scene, this.camera  as THREE.PerspectiveCamera);
          //          console.log( 'rendered' );

        }
      }

      anim()


      //window.addEventListener("resize", this.resize, false);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.$refs.container?.parentElement?.addEventListener('resize', this.resize, false);
      this.resize();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resize(_event?: Event): void {
      if (this.$refs.container) {
        const clientWidth = this.$refs.container?.clientWidth || 0;
        const clientHeight = this.$refs.container?.clientHeight || 0;
        //console.log(clientWidth, clientHeight);
        if(this.controls && this.camera){
          this.camera.aspect = clientWidth / clientHeight;
          this.camera.updateProjectionMatrix();
          this.renderer?.setSize(clientWidth, clientHeight);
          this.controls.update(0);
        }
        this.render3d();
      }
    }

    render3d(): void {
      if (this.scene && this.camera){
        this.scene.background = new THREE.Color(!this.darkMode?'white':'black');
//        if(this.surface)this.scene.add(this.surface)
        this.renderer?.render(this.scene, this.camera);
      }
//      this.$forceUpdate();
    }

    changeLine(line:number){
      const workpiece = (this.scene?.children[0] as THREE.Line)
      const lineArray = workpiece.geometry.getAttribute('line').array as Float32Array
      // console.log(lineArray)
      this.currentframe = lineArray.reduce( (prev,current,index)=>{
        if( Math.abs(current-line) <= Math.abs(current-prev.value))return {index:index,value:current};
        else return prev
      },{index:0,value:lineArray[0]}).index
      //console.log(`Line ${line} => frame: ${this.currentframe}`,lineArray)
      this.changeFrame()
    }

    changeFrame(){
      const workpiece = (this.scene?.children[0] as THREE.Line)
      const colorArray = workpiece.geometry.getAttribute('org_color').array as Float32Array
      const newColorArray = Float32Array.from(colorArray.slice().reduce( (prev,cur,index,org)=>{
        if(index % 3 == 0){
          if(index < this.currentframe*3){
            prev.push(org[index],org[index+1],org[index+2])
          } else if (index === this.currentframe*3){
            prev.push(...this.motionColor.CURRENT.toArray())
          } else {
            prev.push(...this.motionColor.NEXT.toArray())
          }
        }
        return prev
      },[] as number[]))
      workpiece.geometry.setAttribute( 'color',new THREE.BufferAttribute(newColorArray,3)) 
      this.render3d()
    }
};
</script>

<style scoped>
#container {
  height: 100%;
  min-height: 20em;
  width: 100%;
  overflow: hidden;
  display: block;
}

.control {
  position: absolute;
}

.infobox {
  color: black;
  position: absolute;
}

.progress {
  width: 100%;
  height: .5em;
  bottom: calc(-100% + 0.5em);
  left: -50%;
}
</style>
