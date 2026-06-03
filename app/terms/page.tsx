/**
 * Terms and Conditions page — pública (sem auth).
 *
 * Necessária pra Twilio A2P 10DLC Campaign Registration.
 *
 * URL pública: https://jcn-crm.vercel.app/terms
 */

export const metadata = {
  title: "Terms and Conditions — JCN Construction Inc.",
  description: "Terms and conditions for JCN Construction Inc. services and SMS.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-900">
      <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
      <p className="text-sm text-zinc-500 mb-8">
        JCN Construction Inc. — Last updated: June 3, 2026
      </p>

      <section className="prose prose-zinc max-w-none space-y-6 leading-relaxed">
        <p>
          These Terms and Conditions (&ldquo;Terms&rdquo;) govern your use of services provided
          by JCN Construction Inc. (&ldquo;JCN&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;), including SMS
          messaging communications. By engaging us for construction services or
          providing your phone number for SMS messages, you agree to these Terms.
        </p>

        <h2 className="text-xl font-bold pt-4">1. SMS Messaging Service</h2>
        <p>
          When you provide your mobile phone number to JCN Construction, you agree
          to receive SMS messages related to your inquiry, estimate, and active
          project. Messages may include:
        </p>
        <ul className="list-disc pl-6">
          <li>Estimate follow-ups and clarifications</li>
          <li>Site visit confirmations and reminders</li>
          <li>Project status updates (permit, materials, work in progress, completion)</li>
          <li>Responses to your questions</li>
          <li>Notices required to perform your construction project</li>
        </ul>

        <h2 className="text-xl font-bold pt-4">2. Opt-in Methods</h2>
        <p>You opt in to receive SMS messages by:</p>
        <ul className="list-disc pl-6">
          <li>
            <strong>Web form:</strong> Submitting our contact form at{" "}
            <a
              href="https://jcnconstructioninc.com"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              jcnconstructioninc.com
            </a>{" "}
            with your phone number
          </li>
          <li>
            <strong>Verbal consent:</strong> Verbally agreeing during phone calls or
            site visits to receive follow-up SMS about your project
          </li>
        </ul>

        <h2 className="text-xl font-bold pt-4">3. Opt-out (STOP)</h2>
        <p>
          You can stop receiving SMS messages at any time by replying{" "}
          <strong>STOP</strong> to any SMS message we send. After receiving your
          STOP message:
        </p>
        <ul className="list-disc pl-6">
          <li>
            We will send one final confirmation message acknowledging your opt-out
          </li>
          <li>You will not receive any further SMS messages from us</li>
          <li>
            You may continue to receive emails and phone calls about your project
          </li>
          <li>
            To resume SMS messages later, reply <strong>START</strong>, or contact us
            at{" "}
            <a href="tel:+18572375602" className="underline">
              (857) 237-5602
            </a>
          </li>
        </ul>

        <h2 className="text-xl font-bold pt-4">4. Help (HELP)</h2>
        <p>
          For help with SMS messages, reply <strong>HELP</strong> to any message, or
          contact:
        </p>
        <ul className="list-disc pl-6">
          <li>
            Email:{" "}
            <a href="mailto:info@jcnconstructioninc.com" className="underline">
              info@jcnconstructioninc.com
            </a>
          </li>
          <li>
            Phone:{" "}
            <a href="tel:+18572375602" className="underline">
              (857) 237-5602
            </a>
          </li>
        </ul>

        <h2 className="text-xl font-bold pt-4">5. Message Frequency</h2>
        <p>
          You may receive up to 6 SMS messages per month for an active project,
          depending on project status. Frequency is event-driven, not promotional.
          Typical project journey includes: estimate follow-up (1-3 messages over
          14 days if no response), visit confirmation (1-2 messages around scheduled
          dates), and project status updates (1-3 messages during active construction).
        </p>

        <h2 className="text-xl font-bold pt-4">6. Message and Data Rates</h2>
        <p className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 font-medium">
          <strong>Message and data rates may apply.</strong> Standard text messaging
          rates from your wireless carrier may apply to messages you send and
          receive. JCN Construction is not responsible for any carrier charges. If
          you have questions about your wireless plan, contact your wireless carrier
          directly.
        </p>

        <h2 className="text-xl font-bold pt-4">7. Supported Carriers</h2>
        <p>
          Our SMS service is compatible with major U.S. wireless carriers, including
          AT&amp;T, Verizon Wireless, T-Mobile (including former Sprint), U.S.
          Cellular, and others. Carriers are not liable for delayed or undelivered
          messages.
        </p>

        <h2 className="text-xl font-bold pt-4">8. Privacy</h2>
        <p>
          Your use of our SMS service is also governed by our{" "}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>
          . We do not sell, share, rent, or otherwise disclose your mobile phone
          number to any third party for marketing purposes.
        </p>

        <h2 className="text-xl font-bold pt-4">9. Construction Services</h2>
        <p>
          Our construction services (deck, siding, stone patio, and related
          residential exterior work) are provided pursuant to a separate written
          contract signed at the time of project engagement. These Terms govern the
          SMS communication channel only and do not replace or modify the project
          contract.
        </p>

        <h2 className="text-xl font-bold pt-4">10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date at the
          top will reflect the most recent revision. Continued use of our SMS service
          after changes constitutes acceptance of the updated Terms.
        </p>

        <h2 className="text-xl font-bold pt-4">11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the Commonwealth of Massachusetts,
          without regard to its conflict of laws principles. Any dispute arising
          from these Terms or the SMS service will be resolved in the state or
          federal courts located in Suffolk County, Massachusetts.
        </p>

        <h2 className="text-xl font-bold pt-4">12. Contact</h2>
        <p>
          Questions about these Terms? Contact us:
        </p>
        <ul className="list-disc pl-6">
          <li>
            Email:{" "}
            <a href="mailto:info@jcnconstructioninc.com" className="underline">
              info@jcnconstructioninc.com
            </a>
          </li>
          <li>
            Phone:{" "}
            <a href="tel:+18572375602" className="underline">
              (857) 237-5602
            </a>
          </li>
          <li>Mail: JCN Construction Inc., 47 Rand St, Apt 1, Revere, MA 02151</li>
        </ul>
      </section>

      <footer className="mt-12 pt-6 border-t border-zinc-200 text-sm text-zinc-500">
        © {new Date().getFullYear()} JCN Construction Inc. — EIN 92-2361193.
        47 Rand St, Apt 1, Revere, MA 02151. Licensed General Contractor in Massachusetts.
      </footer>
    </main>
  );
}
