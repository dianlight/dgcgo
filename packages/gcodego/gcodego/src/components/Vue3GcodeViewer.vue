<template>
  <div
    id="container"
    ref="container"
  />
  <div class="row control">
    <q-btn-group outline>
      <q-btn outline label="Center" @click="center"/>
      <q-btn outline label="Origin" disable/>
    </q-btn-group>
    <p _class="infobox"> {{ camera.matrix }} </p>
    <!--Button 
      label="Center" 
      icon="pi pi-table" 
      class="p-button-sm p-button-rounded" 
      @click="center()" 
    /-->
    <!--Button label="Delete" icon="pi pi-trash" class="p-button-sm p-button-rounded"/>
    <Button label="Cancel" icon="pi pi-times" class="p-button-sm p-button-rounded"/-->
  </div>
  <!--ProgressBar class="progress" mode="indeterminate"/-->
</template>

<script lang="ts">
import * as THREE from 'three';
//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OrbitControls } from '@three-ts/orbit-controls';
import { defineComponent, Prop, ref } from 'vue';
import Toolpath, { Modal, Position, LoadEventData } from 'gcode-toolpath';
import colornames from 'colornames';


const defaultColor = new THREE.Color(colornames('lightgrey'));
class MotionColor {

    G0 = new THREE.Color(colornames('green'))
    G1 = new THREE.Color(colornames('blue'))
    G2 = new THREE.Color(colornames('deepskyblue'))
    G3 = new THREE.Color(colornames('deepskyblue'))

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

export default defineComponent({
  name: 'Vue3GcodeViewer',
  components: {
//    ProgressBar
  },
  props: {
    gcgrid: {
      type: Boolean,
      required: true,
      default: new Boolean('true'),
    } as Prop<boolean>,
    darkMode: {
      type: Boolean,
      required: false,
      default: new Boolean('false')
    } as Prop<boolean>,
    gcode: {
      type: String,
      required: false,
      default: undefined,
    } as Prop<string>,
  },
  setup() {
    let renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer();
    let scene: THREE.Scene = new THREE.Scene();
    let camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
      50,
      1,
      0.1,
      1000
    );
    let controls: OrbitControls = new OrbitControls(
      camera,
      renderer.domElement
    );
    // controls.addEventListener("change",(event)=>console.log("Camera:",event));
    const container = ref<HTMLElement>();
    let width = 0
    let height = 0

    const motionColor = new MotionColor(false)

    return {
      renderer,
      scene,
      camera,
      controls,
      container,
      width,
      height,
      motionColor
    };
  },
  data() {
    return {
      reload: true,
      space: { start: { x: 0, y: 0 }, stop: { x: 0, y: 0 } },
    };
  },
 emits: {
   onprogress: null
 },
 watch: {
    gcode(newData: string, oldData: string) {
     if (newData != oldData) {
        this.reload = true;
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    darkMode(newData:boolean, _oldData:boolean){
        console.log('Dark mode change to:',newData)
        this.render3d()
    }
  },

  mounted() {
    this.init();
    //this.animate();
  },

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
          const color = modal.motion? this.motionColor[modal.motion] || defaultColor: defaultColor;
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
                const color = motion? this.motionColor[motion] || defaultColor : defaultColor;

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
    

      const frames: {
        data: string,
        vertexIndex: number // remember current vertex index
      } [] = []

      toolPath.loadFromString(this.gcode, (err: unknown, data: string) => {
            if(err)console.error(err)
            frames.push({
                data: data,
                vertexIndex: vertices.length // remember current vertex index
            });
      })
        .on('data',(event: { line: string, words: Array<string|number>})=>{
        //  console.log("Data:",event)
          if(this.gcode)
            this.$emit('onprogress',event.line.length / this.gcode.length * 100)
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .on('end',(_event: LoadEventData[])=>{
            const workpiece = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({
                    color: defaultColor,
                    linewidth: 1,
                    vertexColors: true, // THREE.VertexColors,
                    opacity: 0.5,
                    transparent: true
                })
            );
            workpiece.geometry.setFromPoints(vertices.slice());
            workpiece.geometry.setAttribute( 'color', new THREE.BufferAttribute(
              new Float32Array(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                colors.map( color=>[ color.r, color.g, color.b ]).flat()
              ),3))

            this.scene.add(workpiece);

            workpiece.geometry.computeBoundingBox()
            if(workpiece.geometry.boundingBox){
              const bbox = workpiece.geometry.boundingBox;
              this.width = (bbox.max.x - bbox.min.x)
              this.height = (bbox.max.y - bbox.min.y)

              if (this.gcgrid) {
                const axesHelper = new THREE.AxesHelper(5);
                this.scene.add(axesHelper);                const gridHelper = new THREE.GridHelper(
                  Math.max(this.width, this.height),
                  Math.max(this.width, this.height) / 10
                );
                gridHelper.rotateX(Math.PI / 2);
                //      gridHelper.rotateOnAxis()
                gridHelper.position.y = (this.height - 10) / 2;
                gridHelper.position.x = (this.width - 10) / 2;
                gridHelper.position.z = 0;
                this.scene.add(gridHelper);
              }

              this.controls.target.y = (this.height) / 2;
              this.controls.target.x = (this.width) / 2;
              this.camera.position.x = (this.width) / 2;
              this.camera.position.y = (this.height) / 2;
              this.camera.position.z = (this.width) * 1.3;
              this.camera.updateProjectionMatrix();

              this.controls.update();
            }

            this.render3d()
            this.$emit('onprogress',100)


        })
    }
  },
  methods: {
    center(){
      this.controls.target.y = (this.height) / 2;
      this.controls.target.x = (this.width) / 2;
      this.camera.position.x = (this.width) / 2;
      this.camera.position.y = (this.height) / 2;
      this.camera.position.z = (this.width) * 1.3;
      this.camera.updateProjectionMatrix();

      this.controls.update();
      this.render3d();
    },
    init(): void {
      this.scene.background = new THREE.Color(!this.darkMode?'white':'black');
      /*
const plane = new THREE.Plane( new THREE.Vector3( 0, 0, 0 ), 0 );
const helper = new THREE.PlaneHelper( plane, this.width > this.height?this.width*1.2:this.height*1.2, 0xffff00 );
this.scene.add( helper );     
*/
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.container?.appendChild(this.renderer.domElement);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.controls.addEventListener('change', this.render3d ); // use if there is no animation loop
      this.controls.minDistance = -500;
      this.controls.maxDistance = 500;
      this.controls.enablePan = true;
      this.controls.target.z = 0.0;
      //window.addEventListener("resize", this.resize, false);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.container?.parentElement?.addEventListener('resize', this.resize, false);
      this.resize();
    },
    resize(event?: Event): void {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      if(this.container)console.log('State',event?.target,(this.container as any).value);
      if (this.container) {
        const clientWidth = this.container?.clientWidth || 0;
        const clientHeight = this.container?.clientHeight || 0;
        //console.log(clientWidth, clientHeight);
        this.camera.aspect = clientWidth / clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(clientWidth, clientHeight);
        this.controls.update();
        this.render3d();
      }
    },
    render3d(): void {
      if (this.scene && this.camera){
        this.scene.background = new THREE.Color(!this.darkMode?'white':'black');
        this.renderer.render(this.scene, this.camera);
      }
      this.$forceUpdate();
    },
  },
});
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
