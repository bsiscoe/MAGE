import { initMAGE } from "mage";

const engine = await initMAGE({
    canvas: document.getElementById("myCanvas"),
    withControls: true,
    autoStart: true,
    log: true
});

engine.start();

