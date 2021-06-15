<template>
    <div class='col-10'
      id="container"
      ref="container"
    />
    <div class='col self-start' style="margin-left:-3em;">
      <q-slider :style="`height:${chight}px`"
          v-model="currentframe"
          :min="0"
          :max="totalframes"
          :step="1"
          color="green"
          vertical
          reverse
          snap
          dense
          markers
          label-always
          @change="changeFrame"
      />
    </div>
    <div class="row control">
      <q-btn-group outline>
        <q-btn outline label="Center" @click="center"/>
        <q-btn outline label="Origin" disable/>
      </q-btn-group>
      <slot></slot>    
      <p _class="infobox"> {{ camera?.matrix }} </p>
    </div> 
</template>

<script lang="ts">

import * as THREE from 'three';
import { OrbitControls } from '@three-ts/orbit-controls';
//import { defineComponent, Prop, ref } from 'vue';
import Toolpath, { Modal, Position, LoadEventData } from 'gcode-toolpath';
import colornames from 'colornames';
import { dom } from 'quasar'
import { Options, Vue } from 'vue-class-component';

class Props {
    gcgrid?:boolean
    darkMode?:boolean
    gcode?:string
    displayFrame?:number
}

class MotionColor {

    G0 = new THREE.Color(colornames('green'))
    G1 = new THREE.Color(colornames('blue'))
    G2 = new THREE.Color(colornames('deepskyblue'))
    G3 = new THREE.Color(colornames('deepskyblue'))
    CURRENT = new THREE.Color(colornames('yellow'))
    NEXT = new THREE.Color(colornames('grey'))

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
  components: {},
  watch: {
    gcode(newData: string, oldData: string) {
     if (newData != oldData) {
        (this as Vue3GcodeViewer).reload = true;
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    darkMode(newData:boolean, _oldData:boolean){
        console.log('Dark mode change to:',newData);
        (this as Vue3GcodeViewer).render3d()
    }
  },
  emits: {
    onprogress: null
  }
})
export default class Vue3GcodeViewer extends Vue.with(Props) {

  declare $refs: {
    container: HTMLDivElement
  }

  defaultColor = new THREE.Color(colornames('lightgrey'));

  currentframe = 0;
  totalframes = 0;
  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
  controls?: OrbitControls;
  width = 0
  height = 0

  motionColor = new MotionColor(false)

  reload = true
  space ={ start: { x: 0, y: 0 }, stop: { x: 0, y: 0 } }
  chight = 10


  created(){
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer();
    this.camera = new THREE.PerspectiveCamera(
      50,
      1,
      0.1,
      1000
    );
    this.controls = new OrbitControls(
      this.camera,
      this.renderer?.domElement
    );
    this.currentframe = this.$props.displayFrame || Number.MAX_VALUE
  }
  

  mounted() {
    this.init();
    this.chight = dom.height(this.$refs.container) 
    console.log(dom.height(this.$refs.container))
    //this.animate();
  }

  updated(): void {
    this.motionColor.darkMode = this.darkMode || false
    //  console.log("GCODE UPDATE EVENT!", this.gcodedata, this.reload);
    if (this.gcode && this.reload) {
      this.$emit('onprogress',0)
      this.reload = false;

      const vertices:Array<THREE.Vector3> = [] 
      const colors:Array<THREE.Color> = []
      
      const toolPath = new Toolpath({
        position: [0, 0, 0],
        modal: {
          distance: 'G90',
        },
        addLine: (
          modal: Modal,
          p1: Position,
          p2: Position
        ) => {
          const color = modal.motion? this.motionColor[modal.motion] || this.defaultColor: this.defaultColor;
          vertices.push(new THREE.Vector3(p2.x, p2.y, p2.z));
          colors.push(color);
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
                }
        },
      });
    
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      toolPath.loadFromString(this.gcode, (err: unknown, _data: string) => {
            if(err)console.error(err)
            this.totalframes = vertices.length
      })
        .on('data',(event: { line: string, words: Array<string|number>})=>{
        //  console.log("Data:",event)
          if(this.gcode)
            this.$emit('onprogress',event.line.length / this.gcode.length * 100)
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .on('end',(_event: LoadEventData[])=>{
            this.scene?.clear()
            const workpiece = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({
                    color: this.defaultColor,
                    linewidth: 1,
                    vertexColors: true, // THREE.VertexColors,
                    opacity: 0.5,
                    transparent: true
                })
            );

            this.scene?.add(workpiece);

            workpiece.geometry.setFromPoints(vertices.slice());
            workpiece.geometry.setAttribute( 'org_color', new THREE.BufferAttribute(
              new Float32Array(
                colors.map( color=>[ color.r, color.g, color.b ]).flat()
              ),3))

            workpiece.geometry.computeBoundingBox()
            if(workpiece.geometry.boundingBox){
              const bbox = workpiece.geometry.boundingBox;
              this.width = (bbox.max.x - bbox.min.x)
              this.height = (bbox.max.y - bbox.min.y)

              if (this.gcgrid) {
                const axesHelper = new THREE.AxesHelper(5);
                this.scene?.add(axesHelper);                
                const gridHelper = new THREE.GridHelper(
                  Math.max(this.width, this.height),
                  Math.max(this.width, this.height) / 10
                );
                gridHelper.rotateX(Math.PI / 2);
                //      gridHelper.rotateOnAxis()
                gridHelper.position.y = (this.height - 10) / 2;
                gridHelper.position.x = (this.width - 10) / 2;
                gridHelper.position.z = 0;
                this.scene?.add(gridHelper);
              }

              if(this.controls && this.camera){
                this.controls.target.y = (this.height) / 2;
                this.controls.target.x = (this.width) / 2;
                this.camera.position.x = (this.width) / 2;
                this.camera.position.y = (this.height) / 2;
                this.camera.position.z = (this.width) * 1.3;
                this.camera.updateProjectionMatrix();

                this.controls.update();
              }
            }

            this.changeFrame()
            this.render3d()
            this.$emit('onprogress',100)


        })
    }
  }

  
    center(){
      if(this.controls && this.camera){
        this.controls.target.y = (this.height) / 2;
        this.controls.target.x = (this.width) / 2;
        this.camera.position.x = (this.width) / 2;
        this.camera.position.y = (this.height) / 2;
        this.camera.position.z = (this.width) * 1.3;
        this.camera.updateProjectionMatrix();

        this.controls.update();
      }
      this.render3d();
    }

    init(): void {
      if(this.scene)this.scene.background = new THREE.Color(!this.darkMode?'white':'black');
      /*
const plane = new THREE.Plane( new THREE.Vector3( 0, 0, 0 ), 0 );
const helper = new THREE.PlaneHelper( plane, this.width > this.height?this.width*1.2:this.height*1.2, 0xffff00 );
this.scene.add( helper );     
*/
      this.renderer?.setPixelRatio(window.devicePixelRatio);
      this.$refs.container?.appendChild(this.renderer?.domElement as Node);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.controls?.addEventListener('change', this.render3d ); // use if there is no animation loop
      if(this.controls){
        this.controls.minDistance = -500;
        this.controls.maxDistance = 500;
        this.controls.enablePan = true;
        this.controls.target.z = 0.0;
      }
      //window.addEventListener("resize", this.resize, false);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.$refs.container?.parentElement?.addEventListener('resize', this.resize, false);
      this.resize();
    }

    resize(event?: Event): void {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      if(this.$refs.container)console.log('State',event?.target,(this.$refs.container as any).value);
      if (this.$refs.container) {
        const clientWidth = this.$refs.container?.clientWidth || 0;
        const clientHeight = this.$refs.container?.clientHeight || 0;
        //console.log(clientWidth, clientHeight);
        if(this.controls && this.camera){
          this.camera.aspect = clientWidth / clientHeight;
          this.camera.updateProjectionMatrix();
          this.renderer?.setSize(clientWidth, clientHeight);
          this.controls.update();
          }
        this.render3d();
      }
    }

    render3d(): void {
      if (this.scene && this.camera){
        this.scene.background = new THREE.Color(!this.darkMode?'white':'black');
        this.renderer?.render(this.scene, this.camera);
      }
      this.$forceUpdate();
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
