/* Loader Lab only. The public Central loader does not import this prototype. */
(function(root) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  function clamp(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  // Coordinates share the canonical artwork's 382.33 × 548.81 canvas.
  // Rows overlap so the reveal has a scalloped popcorn edge, never a wipe.
  var clusters = [
    [176, 183], [213, 177], [240, 192], [151, 178], [277, 194],
    [103, 180], [325, 185], [59, 164], [351, 164],
    [151, 155], [187, 150], [247, 139], [287, 163], [307, 155],
    [67, 144], [104, 134], [134, 143], [165, 104], [226, 107],
    [276, 121], [299, 130], [334, 142], [89, 124], [115, 95],
    [141, 87], [237, 94], [202, 76], [181, 63],
  ].map(function(point, index, list) {
    return { x: point[0], y: point[1], threshold: 3 + index * (94 / (list.length - 1)), radius: 34 };
  });

  var TICKET_START = 82;
  var TICKET_CENTER = {x: 289.15, y: 63.03};
  function smooth(t) { return t * t * (3 - 2 * t); }
  function ticketPose(phase, origin) {
    var t = Math.max(0, Math.min(1, phase));
    var hover = {x: origin.x + 35, y: origin.y + 58};
    if (t < 0.28) {
      var emerge = 1 - Math.pow(1 - t / 0.28, 3);
      return {x: origin.x + 35 * emerge, y: origin.y + 58 * emerge,
        scale: 0.50 + 0.88 * emerge, angle: -6 + 18 * emerge, front: t > 0.17};
    }
    if (t < 0.84) {
      var fall = (t - 0.28) / 0.56;
      return {x: hover.x + (TICKET_CENTER.x - hover.x) * smooth(fall),
        y: hover.y + (TICKET_CENTER.y - hover.y) * fall * fall,
        scale: 1.38 - 0.38 * smooth(fall), angle: 12 - 18 * smooth(fall), front: t < 0.76};
    }
    var settle = (t - 0.84) / 0.16;
    return {x: TICKET_CENTER.x, y: TICKET_CENTER.y + Math.sin(settle * Math.PI) * 12,
      scale: 1, angle: -6 * (1 - settle) * Math.cos(settle * Math.PI * 2), front: false};
  }

  function Timeline(points, random) {
    this.points = points || clusters;
    this.random = random || Math.random;
    this.seek(0);
  }
  Timeline.prototype.seek = function(value) {
    this.progress = clamp(value);
    this.flights = [];
    this.flyaways = [];
    this.pulses = [];
    this.nextShakeAt = -Infinity;
    this.ticketFlight = null;
    this.ticketProgress = Math.max(0, Math.min(1, (this.progress - TICKET_START) / (100 - TICKET_START)));
    this.settled = new Set();
    if (!this.flyawayPlan || this.progress === 0) {
      this.flyawayPlan = [15, 35, 57, 78].map(function(threshold, index) {
        return {index: index, threshold: threshold + this.random() * 8,
          direction: (index % 2 ? 1 : -1), spread: 0.7 + this.random() * 0.5,
          startX: 156 + this.random() * 60, duration: 1250 + this.random() * 400};
      }, this);
    }
    this.points.forEach(function(point, index) {
      if (point.threshold <= this.progress) this.settled.add(index);
    }, this);
  };
  Timeline.prototype.advance = function(value, now) {
    var next = clamp(value);
    if (next < this.progress) {
      this.seek(next);
      return;
    }
    var batch = 0;
    this.points.forEach(function(point, index) {
      if (point.threshold > this.progress && point.threshold <= next) {
        var start = now + Math.min(batch * 36, 360);
        this.flights.push({index: index, start: start, duration: 620 + (index % 4) * 45});
        // A few stronger impulses read as individual shakes, not a constant buzz.
        if (index % 5 === 0 && start >= this.nextShakeAt) {
          this.pulses.push({start: start, strength: index % 2 ? -1 : 1});
          this.nextShakeAt = start + 650;
        }
        batch += 1;
      }
    }, this);
    this.flyawayPlan.forEach(function(plan) {
      if (plan.threshold > this.progress && plan.threshold <= next) {
        this.flyaways.push(Object.assign({start: now}, plan));
      }
    }, this);
    if (!this.ticketFlight && next >= TICKET_START && this.ticketProgress < 1) {
      this.ticketFlight = {start: now - this.ticketProgress * 1450, duration: 1450};
      this.pulses.push({start: this.ticketFlight.start + 1450 * 0.84, strength: 1.3});
    }
    this.progress = next;
  };
  Timeline.prototype.frame = function(now) {
    this.flights = this.flights.filter(function(flight) {
      if (now >= flight.start + flight.duration) {
        this.settled.add(flight.index);
        return false;
      }
      return true;
    }, this);
    this.flyaways = this.flyaways.filter(function(flight) { return now < flight.start + flight.duration; });
    this.pulses = this.pulses.filter(function(pulse) { return now < pulse.start + 1200; });
    if (this.ticketFlight) {
      this.ticketProgress = Math.max(0, Math.min(1, (now - this.ticketFlight.start) / this.ticketFlight.duration));
      if (this.ticketProgress === 1) this.ticketFlight = null;
    }
    var motion = this.pulses.reduce(function(result, pulse) {
      var age = now - pulse.start;
      if (age < 0) return result;
      var tail = 1 - smooth(Math.max(0, Math.min(1, (age - 950) / 250)));
      var strength = pulse.strength * tail;
      result.bucketAngle += strength * 3.1 * Math.sin(age / 115) * Math.exp(-age / 310);
      // A short, sharper translation sits on top of the slower rotation.
      result.jitterX += strength * 4.2 * Math.sin(age / 19) * Math.exp(-age / 95);
      result.jitterY -= Math.abs(strength) * 2.8 * Math.abs(Math.sin(age / 26)) * Math.exp(-age / 100);
      var lag = age - 90;
      if (lag > 0) result.foliageAngle -= strength * 6.5 * Math.sin(lag / 125) * Math.exp(-lag / 400);
      return result;
    }, {bucketAngle: 0, foliageAngle: 0, jitterX: 0, jitterY: 0});
    var busy = !!(this.flights.length || this.flyaways.length || this.ticketFlight || this.pulses.length);
    return {
      settled: Array.from(this.settled),
      flights: this.flights.map(function(flight) {
        var point = this.points[flight.index];
        var t = Math.max(0, Math.min(1, (now - flight.start) / flight.duration));
        var startX = 186 + ((flight.index % 5) - 2) * 15;
        var lift = 115 + (flight.index % 3) * 19;
        return {index: flight.index, visible: now >= flight.start,
          x: startX + (point.x - startX) * t,
          y: 205 + (point.y - 205) * t - 4 * lift * t * (1 - t),
          angle: (flight.index % 2 ? 1 : -1) * (1 - t) * 150,
          scale: 0.65 + 0.35 * Math.min(1, t * 5)};
      }, this),
      flyaways: this.flyaways.map(function(flight) {
        var t = Math.max(0, Math.min(1, (now - flight.start) / flight.duration));
        return {index: flight.index,
          x: flight.startX + flight.direction * flight.spread * (120 * t + 650 * t * t),
          y: 205 - 780 * t + 120 * t * t,
          scale: 0.05 + 0.8 * Math.pow(1 - t, 1.3),
          angle: flight.direction * 660 * t, opacity: Math.min(1, (1 - t) * 4)};
      }),
      bucketAngle: Math.max(-3.2, Math.min(3.2, motion.bucketAngle)),
      foliageAngle: Math.max(-7, Math.min(7, motion.foliageAngle)),
      jitterX: motion.jitterX,
      jitterY: motion.jitterY,
      busy: busy,
      complete: this.progress === 100 && this.ticketProgress === 1 && !busy,
      ticket: this.ticketProgress,
    };
  };

  function element(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function(key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  async function create(mount) {
    var response = await fetch("/catm-popcorn-layered.svg");
    if (!response.ok) throw new Error("Could not load the layered popcorn illustration.");
    var source = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
    if (source.querySelector("parsererror")) throw new Error("Invalid popcorn illustration.");
    var svg = document.importNode(source.documentElement, true);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var pile = svg.querySelectorAll('[data-catm-layer="pile"]');
    var interior = svg.querySelector("#catm-interior");
    var ticket = svg.querySelectorAll('[data-catm-layer="ticket"]');
    var bucket = svg.querySelector("#catm-bucket");
    var defs = svg.querySelector("defs");
    if (!pile.length || !interior || !ticket.length || !bucket || !defs ||
        !svg.querySelector("#catm-ticket-sprite") ||
        ![1, 2, 3].every(function(index) { return svg.querySelector("#catm-kernel-" + index); })) {
      throw new Error("Incomplete popcorn layers.");
    }
    var mask = element("mask", {id: "catm-lab-pile-mask", maskUnits: "userSpaceOnUse", x: -60, y: -100, width: 500, height: 700});
    defs.appendChild(mask);
    var patches = clusters.map(function(point) {
      var patch = element("g", {fill: "white", display: "none"});
      [[0, 0, 0.82], [-0.5, 0.1, 0.62], [0.36, -0.35, 0.62], [0.35, 0.4, 0.65]].forEach(function(lobe) {
        patch.appendChild(element("circle", {cx: point.x + point.radius * lobe[0], cy: point.y + point.radius * lobe[1], r: point.radius * lobe[2]}));
      });
      mask.appendChild(patch);
      return patch;
    });
    var particles = element("g", {id: "catm-lab-particles", "pointer-events": "none"});
    // The unchanged front of the bucket occludes kernels as they emerge.
    var firstArtwork = svg.querySelector("[data-catm-layer]");
    firstArtwork.parentNode.insertBefore(particles, firstArtwork);
    var sprites = clusters.map(function(point, index) {
      var sprite = element("g", {display: "none"});
      sprite.appendChild(element("use", {href: "#catm-kernel-" + (index % 3 + 1), x: -23, y: -23, width: 46, height: 46}));
      particles.appendChild(sprite);
      return sprite;
    });
    var flyawaySprites = [0, 1, 2, 3].map(function(index) {
      var sprite = element("g", {display: "none"});
      sprite.appendChild(element("use", {href: "#catm-kernel-" + (index % 3 + 1), x: -23, y: -23, width: 46, height: 46}));
      particles.appendChild(sprite);
      return sprite;
    });
    var flyingTicket = element("g", {id: "catm-lab-flying-ticket", display: "none"});
    flyingTicket.appendChild(element("use", {href: "#catm-ticket-sprite", width: 382.33, height: 548.81}));
    svg.appendChild(flyingTicket);
    // Wrap adjacent foliage paths without changing their painter order.
    var foliage = [];
    svg.querySelectorAll('[data-catm-detail="foliage"]').forEach(function(path) {
      var run = path.previousElementSibling;
      if (!run || !run.hasAttribute("data-catm-sway")) {
        run = element("g", {"data-catm-sway": "foliage"});
        path.parentNode.insertBefore(run, path);
        foliage.push(run);
      }
      run.appendChild(path);
    });
    var artwork = Array.from(svg.querySelectorAll("[data-catm-layer]")).concat(interior);
    var logo = mount.parentNode.querySelector(".catm-loader-series-logo");
    var logoE = mount.parentNode.querySelector(".catm-lab-logo-e");
    function ticketOrigin() {
      var matrix = svg.getScreenCTM();
      if (!logo || !matrix) return {x: 230, y: -170};
      var box = logo.getBoundingClientRect();
      var scale = Math.min(box.width / 646.95, box.height / 410.02);
      var width = 646.95 * scale;
      var height = 410.02 * scale;
      var point = svg.createSVGPoint();
      point.x = box.left + (box.width - width) / 2 + width * (501 / 646.95);
      point.y = box.top + (box.height - height) / 2 + height * (211 / 410.02);
      return point.matrixTransform(matrix.inverse());
    }
    var previousMotion = "";
    var isBusy = false;
    var timeline = new Timeline();
    var media = window.matchMedia("(prefers-reduced-motion: reduce)");
    var motionOverride = false;
    var active = true;
    var frameId = 0;
    var disposed = false;
    var idleResolvers = [];

    function motionOff() { return motionOverride || media.matches || !active; }
    function resolveIdle() {
      if (isBusy) return;
      idleResolvers.splice(0).forEach(function(resolve) { resolve(); });
    }
    function draw(now) {
      frameId = 0;
      var state = timeline.frame(now);
      patches.forEach(function(patch, index) { patch.setAttribute("display", timeline.settled.has(index) ? "inline" : "none"); });
      pile.forEach(function(layer) {
        if (state.complete) layer.removeAttribute("mask");
        else layer.setAttribute("mask", "url(#catm-lab-pile-mask)");
      });
      interior.style.opacity = state.complete ? "0" : "1";
      var bucketAngle = motionOff() ? 0 : state.bucketAngle;
      var foliageAngle = motionOff() ? 0 : state.foliageAngle;
      var jitterX = motionOff() ? 0 : state.jitterX;
      var jitterY = motionOff() ? 0 : state.jitterY;
      var bodyTransform = "translate(" + jitterX.toFixed(2) + " " + jitterY.toFixed(2) + ") rotate(" + bucketAngle.toFixed(2) + " 191 520)";
      var ticketLanded = state.ticket >= 1 || (motionOff() && timeline.progress >= TICKET_START);
      // Keep the same complete ticket throughout flight and landing. The old
      // traced ticket is partly occluded artwork, so it is never the flying prop.
      ticket.forEach(function(layer) { layer.style.opacity = "0"; });
      var ticketPhase = ticketLanded ? 1 : state.ticket;
      var pose = ticketPose(ticketPhase, ticketLanded ? TICKET_CENTER : ticketOrigin());
      flyingTicket.setAttribute("display", "inline");
      flyingTicket.setAttribute("transform", (ticketPhase >= 0.84 ? bodyTransform + " " : "") + "translate(" + pose.x + " " + pose.y + ") rotate(" + pose.angle + ") scale(" + pose.scale + ") translate(-289.15 -63.03)");
      // Ticket sits above the marquee but behind the separate E foreground.
      mount.style.zIndex = pose.front ? "4" : "2";
      if (logoE) logoE.style.visibility = !ticketLanded && state.ticket < 0.17 ? "visible" : "hidden";
      if (pose.front && flyingTicket !== svg.lastElementChild) svg.appendChild(flyingTicket);
      else if (!pose.front && flyingTicket.nextElementSibling !== firstArtwork) svg.insertBefore(flyingTicket, firstArtwork);
      mount.dataset.ticketPhase = ticketLanded ? "landed" : state.ticket > 0 ? "flying" : "parked";
      var motionKey = bodyTransform + ":" + foliageAngle.toFixed(2);
      if (motionKey !== previousMotion) {
        foliage.forEach(function(layer) {
          if (foliageAngle) layer.setAttribute("transform", "rotate(" + foliageAngle.toFixed(2) + " 103 235)");
          else layer.removeAttribute("transform");
        });
        artwork.forEach(function(layer) {
          if (bucketAngle || jitterX || jitterY) layer.setAttribute("transform", bodyTransform);
          else layer.removeAttribute("transform");
        });
        previousMotion = motionKey;
      }
      sprites.forEach(function(sprite) { sprite.setAttribute("display", "none"); });
      state.flights.forEach(function(flight) {
        var sprite = sprites[flight.index];
        sprite.setAttribute("display", flight.visible ? "inline" : "none");
        sprite.setAttribute("transform", "translate(" + flight.x + " " + flight.y + ") rotate(" + flight.angle + ") scale(" + flight.scale + ")");
      });
      flyawaySprites.forEach(function(sprite) { sprite.setAttribute("display", "none"); });
      state.flyaways.forEach(function(flight) {
        var sprite = flyawaySprites[flight.index];
        sprite.setAttribute("display", "inline");
        sprite.setAttribute("opacity", flight.opacity);
        sprite.setAttribute("transform", "translate(" + flight.x + " " + flight.y + ") rotate(" + flight.angle + ") scale(" + flight.scale + ")");
      });
      isBusy = state.busy;
      mount.dataset.progress = String(timeline.progress);
      mount.dataset.settled = String(timeline.settled.size);
      mount.dataset.animating = String(state.busy);
      if (state.busy && !disposed) frameId = requestAnimationFrame(draw);
      resolveIdle();
    }
    function render() {
      if (frameId) cancelAnimationFrame(frameId);
      draw(performance.now());
    }
    function settle() {
      timeline.seek(timeline.progress);
      if (timeline.progress >= TICKET_START) timeline.ticketProgress = 1;
      render();
    }
    function onMotionChange() { if (motionOff()) settle(); }
    function onResize() { if (!disposed) render(); }
    window.addEventListener("resize", onResize);
    media.addEventListener("change", onMotionChange);
    render();
    mount.replaceChildren(svg);
    return {
      setProgress: function(value, options) {
        if (disposed) return;
        if (options && options.animate && !motionOff()) timeline.advance(value, performance.now());
        else timeline.seek(value);
        if (motionOff() && timeline.progress >= TICKET_START) timeline.ticketProgress = 1;
        render();
      },
      setReducedMotion: function(value) { motionOverride = !!value; onMotionChange(); },
      setActive: function(value) { active = !!value; if (!active) settle(); },
      whenIdle: function() {
        return isBusy ? new Promise(function(resolve) { idleResolvers.push(resolve); }) : Promise.resolve();
      },
      destroy: function() {
        disposed = true;
        if (frameId) cancelAnimationFrame(frameId);
        media.removeEventListener("change", onMotionChange);
        window.removeEventListener("resize", onResize);
        timeline.seek(timeline.progress);
        timeline.ticketProgress = timeline.progress >= TICKET_START ? 1 : 0;
        draw(performance.now());
      },
    };
  }
  var api = { create: create, Timeline: Timeline, clusters: clusters, ticketPose: ticketPose };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CatmPopcornLab = api;
}(typeof window !== "undefined" ? window : globalThis));
