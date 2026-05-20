# Unity WebGL Builds

Place exported Unity WebGL files here so Vite can serve them as static assets.

Current WebGL builds served by the web app:

```text
web/public/unity/
  Welcome_Scene/
    Build/
      Welcome_Scene.loader.js
      Welcome_Scene.data.br
      Welcome_Scene.framework.js.br
      Welcome_Scene.wasm.br
    TemplateData/
  Room_Tour/
    Build/
    TemplateData/
  Ex_Stage_1/
    Build/
      Ex_Stage_1.loader.js
      Ex_Stage_1.data.br
      Ex_Stage_1.framework.js.br
      Ex_Stage_1.wasm.br
    TemplateData/
  Ex_Stage_2/
    Build/
      Ex_Stage_2.loader.js
      Ex_Stage_2.data.br
      Ex_Stage_2.framework.js.br
      Ex_Stage_2.wasm.br
    TemplateData/
```

Source export locations:

```text
unity/WebGLBuild/Welcome_Scene
unity/WebGLBuild/Room_Tour
unity/WebGLBuild/Ex_Stage_1
unity/WebGLBuild/Ex_Stage_2
```

When Unity is rebuilt, copy the exported folder here and make sure the
corresponding React page points to the same folder and file prefix.

Current page mappings:

```text
Welcome_Scene -> UnityContainer default config / PhaseController
Room_Tour     -> RoomTourPage
Ex_Stage_1    -> TaskPhasePage, phase_2_task_phase
Ex_Stage_2    -> TaskPhasePage, phase_3_task_phase
```

`web/vite.config.js` sets Brotli headers for `.br` Unity files. Without those headers, compressed WebGL builds can fail to load.
