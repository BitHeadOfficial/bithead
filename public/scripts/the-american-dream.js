document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin(ScrollTrigger);

  const scenes = [
    { cx: 1500, cy: 1500, w: 3000 },
    { cx: 2590, cy: 1650, w: 625 },
    { cx: 2075, cy: 1575, w: 600 },
    { cx: 2315, cy: 2020, w: 390 },
    { cx: 1960, cy: 2015, w: 420 },
    { cx: 1575, cy: 1775, w: 725 },
    { cx: 1440, cy: 1565, w: 460 },
    { cx: 1010, cy: 1565, w: 460 },
    { cx: 1045, cy: 1565, w: 460 },
    { cx: 715, cy: 1720, w: 995 },
    { cx: 335, cy: 1990, w: 670 },
    { cx: 250, cy: 1010, w: 385 },
    { cx: 850, cy: 450, w: 405 },
    { cx: 1315, cy: 715, w: 750 },
    { cx: 1635, cy: 510, w: 845 },
    { cx: 2580, cy: 980, w: 835 },
    { cx: 1965, cy: 800, w: 390 },
    { cx: 965, cy: 2625, w: 455 },
    { cx: 900, cy: 2625, w: 400 },
    { cx: 90, cy: 2515, w: 180 },
    { cx: 1775, cy: 2525, w: 580 },
    { cx: 1670, cy: 2525, w: 315 },
    { cx: 1706, cy: 2631, w: 47 },
    { cx: 1950, cy: 2570, w: 120 },
    { cx: 2270, cy: 2615, w: 765 },
    { cx: 2710, cy: 2725, w: 400 },
    { cx: 2752, cy: 2690, w: 185 },
    { cx: 2680, cy: 2410, w: 375 },
    { cx: 1525, cy: 2770, w: 275 },
    { cx: 1525, cy: 2770, w: 275 },
    { cx: 1583, cy: 1511.5, w: 20 },
    { cx: 1500, cy: 1500, w: 3000 },
  ];

  const captions = gsap.utils.toArray(".caption");

  const viewBoxes = scenes.map((scene) => {
    const x = scene.cx - scene.w / 2;
    const y = scene.cy - scene.w / 2;
    return `${x} ${y} ${scene.w} ${scene.w}`;
  });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".art-container",
      start: "top top",
      end: `+=${scenes.length * window.innerHeight * 0.8}`,
      scrub: 1.2,
      pin: true,
    },
  });

  scenes.forEach((_, i) => {
    if (i === 0) return;

    const delayOffset = i * 0.001;

    tl.to(
      "#theAmericanDream",
      {
        attr: { viewBox: viewBoxes[i] },
        duration: 1,
        ease: "power1.inOut",
      },
      i + delayOffset
    );

    // Fade out previous caption (if exists)
    if (captions[i - 1]) {
      tl.to(
        captions[i - 1],
        {
          opacity: 0,
          visibility: "hidden",
          duration: 0.3,
          ease: "power1.inOut",
        },
        i + delayOffset
      );
    }

    // Fade in current caption
    if (captions[i]) {
      tl.to(
        captions[i],
        {
          opacity: 1,
          visibility: "visible",
          duration: 0.3,
          ease: "power1.inOut",
        },
        i + delayOffset
      );
    }
  });

  gsap.set("#theAmericanDream", { attr: { viewBox: viewBoxes[0] } });
});
