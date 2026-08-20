/* game/core/camera.js
   Verfolgerkamera über der Schulter.

   Sie besitzt Gier- und Nickwinkel — der Spieler dreht sich *nach* der Kamera,
   nicht umgekehrt. Deshalb liefert diese Datei auch die Bewegungsbasis
   (`forward`/`right`), an der sich WASD orientiert. */
(function (ROR) {
  'use strict';

  const U = ROR.Util;

  const PITCH_MIN = -1.25;    // knapp über senkrecht nach unten
  const PITCH_MAX = 1.15;

  const desired = new THREE.Vector3();
  const pivot = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const euler = new THREE.Euler();

  const Cam = {
    yaw: 0,
    pitch: 0.28,
    distance: 9.5,
    minDistance: 1.6,
    shoulder: 0.62,           // seitlicher Versatz, damit die Figur nicht die Sicht nimmt
    pivotHeight: 1.55,
    target: null,             // Objekt mit .position
    baseFov: 70,
    fov: 70,
    /* Wird von der Stage gesetzt: gibt zurück, wie weit der Strahl vom Dreh-
       punkt aus frei ist. Ohne diese Funktion schneidet die Kamera durch Felsen. */
    clearance: null,

    init(target) {
      Cam.target = target;
      Cam.position = ROR.Engine.camera.position;
      return Cam;
    },

    /* Läuft je Bild, nicht je Simulationsschritt — sonst ruckelt der Blick auf
       Bildschirmen mit mehr als 60 Hz. */
    update(dt) {
      const look = ROR.Input.takeLook();
      Cam.yaw = U.wrapAngle(Cam.yaw - look.x);
      Cam.pitch = U.clamp(Cam.pitch + look.y, PITCH_MIN, PITCH_MAX);

      if (!Cam.target) return;

      // Drehpunkt läuft der Figur weich hinterher, damit Treppenstufen und
      // Landungen die Kamera nicht mitzucken lassen.
      pivot.set(Cam.target.position.x, Cam.target.position.y + Cam.pivotHeight, Cam.target.position.z);
      Cam._pivotSmooth = Cam._pivotSmooth || pivot.clone();
      Cam._pivotSmooth.x = U.damp(Cam._pivotSmooth.x, pivot.x, 0.035, dt);
      Cam._pivotSmooth.y = U.damp(Cam._pivotSmooth.y, pivot.y, 0.09, dt);
      Cam._pivotSmooth.z = U.damp(Cam._pivotSmooth.z, pivot.z, 0.035, dt);

      const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
      dir.set(Math.sin(Cam.yaw) * cp, sp, Math.cos(Cam.yaw) * cp);

      // Schulterversatz senkrecht zur Blickrichtung, auf der Bodenebene.
      tmp.set(Math.cos(Cam.yaw), 0, -Math.sin(Cam.yaw)).multiplyScalar(Cam.shoulder);

      let dist = Cam.distance;
      if (Cam.clearance) {
        const free = Cam.clearance(Cam._pivotSmooth, dir, dist + 0.4);
        if (free < dist) dist = Math.max(Cam.minDistance, free - 0.35);
      }
      Cam._dist = Cam._dist === undefined ? dist : Cam._dist;
      // Herausfahren weich, Hereinfahren sofort — sonst steckt die Kamera kurz in der Wand.
      Cam._dist = dist < Cam._dist ? dist : U.damp(Cam._dist, dist, 0.12, dt);

      desired.copy(Cam._pivotSmooth).addScaledVector(dir, Cam._dist).add(tmp);

      const c = ROR.Engine.camera;
      c.position.copy(desired);
      /* Ausrichtung direkt aus Gier und Nick, nicht über `lookAt`.
         Zwei Gründe: erstens würde ein lookAt auf die Figur die Bildmitte
         von `aim()` abweichen lassen — die Kamera steht seitlich versetzt,
         und der Schuss ginge sichtbar am Fadenkreuz vorbei. Zweitens rechnet
         `lookAt` mit der Position aus `matrixWorld`, also der des *vorigen*
         Bildes; das allein waren schon gut drei Grad Fehler.
         Reihenfolge YXZ und -pitch, damit die -Z-Achse genau auf `aim()` fällt. */
      euler.set(-Cam.pitch, Cam.yaw, 0, 'YXZ');
      c.quaternion.setFromEuler(euler);

      if (Math.abs(c.fov - Cam.fov) > 0.01) {
        c.fov = U.damp(c.fov, Cam.fov, 0.09, dt);
        c.updateProjectionMatrix();
      }
    },

    /* Sichtfeld weiten — beim Sprinten, damit Tempo spürbar wird. */
    setFovBoost(extra) { Cam.fov = Cam.baseFov + extra; },

    /* Bewegungsbasis auf der Bodenebene. `forward` zeigt dorthin, wo die Kamera
       hinschaut, ohne Nickanteil. */
    forward(out) { return out.set(-Math.sin(Cam.yaw), 0, -Math.cos(Cam.yaw)); },
    right(out) { return out.set(Math.cos(Cam.yaw), 0, -Math.sin(Cam.yaw)); },

    /* Voller Blickvektor inklusive Nicken — womit gezielt wird. */
    aim(out) {
      const cp = Math.cos(Cam.pitch);
      return out.set(-Math.sin(Cam.yaw) * cp, -Math.sin(Cam.pitch), -Math.cos(Cam.yaw) * cp).normalize();
    }
  };

  ROR.Camera = Cam;
})(window.ROR);
