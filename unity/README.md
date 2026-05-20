# Unity Area

This folder contains the Unity project and exported WebGL builds used by the
participant-facing web app.

Current structure:

```text
unity/
  UnityProject/
    RoomTour_Feedback_Experiment/
      Assets/
      Packages/
      ProjectSettings/

  WebGLBuild/
    Welcome_Scene/
    Room_Tour/
    Ex_Stage_1/
    Ex_Stage_2/
```

The Unity project provides:

- Room scene.
- Robot model.
- Robot animations.
- Prerecorded robot audio clips.
- WebGL bridge scripts for receiving frontend commands.
- Event reporting back to the web frontend.
- Room Tour process manager and robot following behavior.
- Task Phase process manager for both Ex_Stage_1 and Ex_Stage_2 builds.

Current task-stage manager:

```text
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Scripts/TaskPhaseProcessManager.cs
```

Current WebGL build deployment workflow:

```text
unity/WebGLBuild/Ex_Stage_1 -> web/public/unity/Ex_Stage_1
unity/WebGLBuild/Ex_Stage_2 -> web/public/unity/Ex_Stage_2
```

After changing Unity scripts or task inspector configuration, rebuild WebGL and
copy the exported folder into `web/public/unity/`.

Unity should not store OpenAI or Supabase secrets.
