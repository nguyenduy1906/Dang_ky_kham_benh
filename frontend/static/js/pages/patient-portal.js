// Preserve a selected doctor when entering the booking page from the public directory.
const chosenDoctor = new URLSearchParams(location.search).get("doctor");
if (chosenDoctor && /^\d+$/.test(chosenDoctor)) {
  document.querySelector('[data-feature="booking"]').href = `booking.html?doctor=${chosenDoctor}`;
}
