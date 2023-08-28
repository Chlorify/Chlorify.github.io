import { Renderer, Program, Geometry, Mesh, Vec2, Flowmap } from 'https://cdn.jsdelivr.net/npm/ogl/dist/ogl.mjs';

const time = { value: 1.0 };
const aspect = 1;
const alpha = 1.0;
const mouse = new Vec2();
const mouseLerpd = new Vec2();
const mouseLerpdL = new Vec2();
const mouseLerpdLL = new Vec2();
const velocity = new Vec2();
const lastMouse = new Vec2();
let lastTime = false;
const renderer = new Renderer({
  dpr: 1,
  canvas: document.querySelector("canvas.metaball")
});
const gl = renderer.gl;
const flowmap = new Flowmap(gl);
let program = null;
let plane = null;

function createOglPlane() {
  const vertex = `
    attribute vec2 uv;
    attribute vec2 position;
    varying vec2 vUv;
    uniform float time;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 0, 1);
    }
  `;
  const fragment = `
    precision highp float;
    precision highp int;
    uniform vec2 resolution;
    uniform vec2 uMouse;
    uniform vec2 uMouseL;
    uniform vec2 uMouseLL;
    uniform float alpha;
    varying vec2 vUv;
    uniform float time;
    uniform sampler2D tFlow;

    float circle(vec2 uv, vec2 pos) {
        return 0.02/distance(uv, pos);
    }
    void main() {
      vec3 flow = texture2D(tFlow, vUv).rgb;

      vec2 uv = vUv;

      //uv -= uMouse;
      uv.x *= resolution.x / resolution.y;
      vec2 uMouseR = vec2(uMouse.x * (resolution.x / resolution.y), uMouse.y);
      vec2 uMouseRL = vec2(uMouseL.x * (resolution.x / resolution.y), uMouseL.y);
      vec2 uMouseRLL = vec2(uMouseLL.x * (resolution.x / resolution.y), uMouseLL.y);

      float r = 0.02;
      // Draw three circles.
      float c = circle(uv - uMouseR, vec2(sin(time * .5) * .11, cos(time * .7) * .11));
      c += circle(uv - uMouseRL, vec2(sin(time * .7) * .11, cos(time * .8) * .11));
      c += circle(uv - uMouseRLL, vec2(sin(time * .2) * .11, cos(time * .3) * .11));
      vec3 ball = vec3(c / (1.5 * r), c / (1.2 * r), c / (3.5 * r));
      gl_FragColor.rgb = vec3(1.0 - ball.x, 1.0 - ball.y, 1.0 - ball.z);
      if (alpha > 0.0) {
        gl_FragColor.a = alpha;
      } else {
        gl_FragColor.a = 0.0;
      }
    }
  `;

  handleEvents();
  gl.clearColor(254, 254, 254, 1);

  // Rather than using a plane (two triangles) to cover the viewport here is a
  // triangle that includes -1 to 1 range for 'position', and 0 to 1 range for 'uv'.
  // Excess will be out of the viewport.
  //         position                uv
  //      (-1, 3)                  (0, 2)
  //         |\                      |\
  //         |__\(1, 1)              |__\(1, 1)
  //         |__|_\                  |__|_\
  //   (-1, -1)   (3, -1)        (0, 0)   (2, 0)
  const geometry = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
    uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) }
  });

  program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      resolution: { value: new Vec2(window.innerWidth, window.innerHeight) },
      alpha: { value: 0.0 },
      time: time,
      tFlow: flowmap.uniform,
      uMouse: { value: mouseLerpd },
      uMouseL: { value: mouseLerpdL },
      uMouseLL: { value: mouseLerpdLL }
    },
    cullFace: null
  });
  plane = new Mesh(gl, { geometry: geometry, program: program });
  renderer.render({ scene: plane, webgl: 1 });
  requestAnimationFrame(update);
  attachScrollEvent();
}

createOglPlane();

// bind mouseevents
function attachScrollEvent() {
  const isTouchCapable = "ontouchstart" in window;
  if (isTouchCapable) {
    window.addEventListener("touchstart", updateMouse, false);
    window.addEventListener("touchmove", updateMouse, false);
  } else {
    window.addEventListener("mousemove", updateMouse, false);
  }
}

// smooth function
function lerp(a, b, t) {
  return (1 - t) * a + t * b;
}

// mouse event listener
function updateMouse(e) {
  if (e.changedTouches && e.changedTouches.length) {
    e.x = e.changedTouches[0].pageX;
    e.y = e.changedTouches[0].pageY;
  }
  if (e.x === undefined) {
    e.x = e.pageX;
    e.y = e.pageY;
  }
  // Get mouse value in 0 to 1 range, with y flipped
  mouse.set(
    e.x / renderer.gl.renderer.width,
    1.0 - e.y / renderer.gl.renderer.height
  );
  // Calculate velocity
  if (!lastTime) {
    // First frame
    lastTime = performance.now();
    lastMouse.set(e.x, e.y);
  }

  const deltaX = e.x - lastMouse.x;
  const deltaY = e.y - lastMouse.y;

  lastMouse.set(e.x, e.y);

  let time = performance.now();

  // Avoid dividing by 0
  let delta = Math.max(14, time - lastTime);
  lastTime = time;
  velocity.x = deltaX / delta;
  velocity.y = deltaY / delta;
  // Flag update to prevent hanging velocity values when not moving
  velocity.needsUpdate = true;
}
function update(t) {
  requestAnimationFrame(update);
  // Reset velocity when mouse not moving
  if (!velocity.needsUpdate) {
    //mouse.set(-1);
    velocity.set(0);
  }
  velocity.needsUpdate = false;
  // Update flowmap inputs
  flowmap.aspect = aspect;
  flowmap.mouse.copy(mouse);
  // Ease velocity input, slower when fading out
  flowmap.velocity.lerp(velocity, velocity.len ? 0.5 : 0.1);
  flowmap.update();
  mouseLerpd.x = lerp(mouseLerpd.x, mouse.x, 0.05);
  mouseLerpd.y = lerp(mouseLerpd.y, mouse.y, 0.05);

  mouseLerpdL.x = lerp(mouseLerpdL.x, mouse.x, 0.025);
  mouseLerpdL.y = lerp(mouseLerpdL.y, mouse.y, 0.025);

  mouseLerpdLL.x = lerp(mouseLerpdLL.x, mouse.x, 0.01);
  mouseLerpdLL.y = lerp(mouseLerpdLL.y, mouse.y, 0.01);
  if (program && program.uniforms) {
    program.needsUpdate = true;
    time.value = t * 0.001;
  }
  program.uniforms.alpha.value = lerp(
    program.uniforms.alpha.value,
    alpha,
    0.05
  );
  renderer.render({ scene: plane });
}

// handle resize event
function handleEvents() {
  window.addEventListener("resize", resize, false);
  resize();
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (program && program.uniforms) {
    program.needsUpdate = true;
    program.uniforms.resolution.value = new Vec2(
      window.innerWidth,
      window.innerHeight
    );
  }
}
