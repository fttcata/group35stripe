# Project 40 : Stripe

## Payments with Stripe: Athletic Events Ticketing and Onsiste Registration Platform

## Project Description

Stripe is an Irish-American multinational financial services company that primarily others payment-processing software for e-commerce websites and mobile applications. For this project, students will take on the role of a sporting event organizer (like Bear Races or Let's Do This) that is creating a hosted web-application to create events and sell tickets using Stripe APIs! The MVP should include a user management system that allows:

- Organizers to create/manage events and define ticket prices/quantities.
- Attendees to browse and sign up for events, purchase tickets, and check-in on event day.
- Event staff to register pre-booked attendees and accept payments onsite.

Here is a breakdown of the project requirements:

- An event management system that allows organizers to add titles, descriptions, venues, images, etc. Organizers should be able to define ticket types (e.g., General, Student, Over 60s) with different prices and quantities.
- A ticket purchasing system that allows consumers to create an account or checkout as a guest and receive tickets via email. Users should be able to decide whether they want to "pay now" (i.e., when booking the tickets) or "pay on the day" (i.e., pay at registration on the day of the event).
- A registration system that allows event stah to look up attendees by name, ticket ID, or scanning a QR code and mark them as checked-in. Any "pay on the day" tickets should be paid for using a Stripe Terminal which will be provided to the team.
- Utilise Stripe billing to add a subscription payment option (e.g. early access to race entry for members).
- Use of a free serverless/hosting provider (e.g., Netlify) so the application can be viewed in any browser instead of having to be spun up locally.
- Unit/integration testing.

A more sophisticated system would:

- Integrate Stripe Connect so third-party event organizers can onboard as Connected Accounts and host their own events on your platform!
- Allow event attendees to refund, resell or transfer their tickets within the application.
- Implement customizable data visualizations that allow organizers to analyze live ticket sales, revenue totals, attendee demographics and check-in rates.
- Have automated CI/CD for tests.

**Chosen stack: Next.js + Vercel + Supabase + Stripe**
