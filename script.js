let count = 0;

const button = document.getElementById("clickMe");
const counter = document.getElementById("counter");

button.addEventListener("click", () => {
  count++;
  counter.textContent = `You clicked ${count} time${count === 1 ? "" : "s"}.`;
});
