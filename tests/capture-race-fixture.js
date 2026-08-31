// These handlers deliberately change the page synchronously, like a SPA menu.
for (const id of ["move", "route"]) {
  const element = document.getElementById(id);
  element.addEventListener("click", (event) => {
    event.preventDefault();
    const count = Number(element.dataset.actions || 0) + 1;
    element.dataset.actions = String(count);
    if (id === "move") element.style.marginLeft = "100px";
    else history.pushState({}, "", element.href);
    const captures = [...document.querySelectorAll("#events li")];
    document.getElementById("race-result").textContent =
      `${id}: ação ${count}; capturas concluídas: ${captures.length}; ` +
      `todas estáveis: ${captures.every((item) => item.dataset.captureStable === "true")}`;
  });
}
