# Example 3D model

`teacher-desk.glb` is an illustrative procedural desk with drawers and an office chair, exported with Three.js GLTFExporter from `createProductModel` in the Space Designer storefront. It adapts the furniture concept in the v0 reference; it is an approximate visualization, not a manufacturer-supplied model or certified CAD file.

Dimensions cover the entire assembly, including the chair: 1.30 m wide, 0.70 m deep, 0.76 m high. The base is at Y=0 and the model is centred on X/Z. Materials and geometry are embedded; no external files or texture requests are required.

Use `/space-designer/examples/models/teacher-desk.glb` as the model URL in the backoffice with asset kind `glb`. Set fallback model to `desk` and the dimensions above. For a backoffice served on another origin, use the storefront's full URL. The procedural `desk` remains the fallback when loading fails.
