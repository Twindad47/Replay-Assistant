import { getSessionCodeFromUrl } from "./session.js";

const form = document.getElementById("feedbackForm");
const sport = document.getElementById("feedbackSport");
const rating = document.getElementById("feedbackRating");
const comments = document.getElementById("feedbackComments");
const contact = document.getElementById("feedbackContact");
const submitButton = document.getElementById("feedbackSubmitButton");
const status = document.getElementById("feedbackStatus");
const pageUrl = new URL(window.location.href);
const requestedSport = pageUrl.searchParams.get("sport");

if (requestedSport) {
  const match = [...sport.options].find(
    (option) => option.value.toLowerCase() === requestedSport.toLowerCase()
  );
  if (match) sport.value = match.value;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = "Sending…";
  status.textContent = "";

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: sport.value,
        rating: rating.value,
        comments: comments.value.trim(),
        contact: contact.value.trim(),
        sessionCode: getSessionCodeFromUrl()
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to send feedback.");

    form.reset();
    status.textContent = "Thank you. Your beta feedback was received.";
    status.className = "feedback-status is-success";
  } catch (error) {
    status.textContent = error.message || "Unable to send feedback. Please try again.";
    status.className = "feedback-status is-error";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Beta Feedback";
  }
});
