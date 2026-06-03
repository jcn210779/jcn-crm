/**
 * Privacy Policy page — pública (sem auth).
 *
 * Necessária pra Twilio A2P 10DLC Campaign Registration. Twilio valida que
 * a URL existe e contém: statement of non-sharing for mobile numbers,
 * message frequency, "message and data rates may apply" disclosure.
 *
 * URL pública: https://jcn-crm.vercel.app/privacy
 */

export const metadata = {
  title: "Privacy Policy — JCN Construction Inc.",
  description: "Privacy policy for JCN Construction Inc.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-900">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mb-8">
        JCN Construction Inc. — Last updated: June 3, 2026
      </p>

      <section className="prose prose-zinc max-w-none space-y-6 leading-relaxed">
        <p>
          JCN Construction Inc. (&ldquo;JCN&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) respects
          your privacy and is committed to protecting any personal information you share
          with us. This Privacy Policy explains what information we collect, how we use
          it, and the choices you have.
        </p>

        <h2 className="text-xl font-bold pt-4">1. Information We Collect</h2>
        <p>
          When you request an estimate, schedule a site visit, or contact us, we may
          collect the following personal information:
        </p>
        <ul className="list-disc pl-6">
          <li>Name</li>
          <li>Mobile or landline phone number</li>
          <li>Email address</li>
          <li>Property address where work would be performed</li>
          <li>Type of construction service requested (deck, siding, patio, etc.)</li>
          <li>Notes about your project</li>
        </ul>

        <h2 className="text-xl font-bold pt-4">2. How We Use Your Information</h2>
        <p>We use the information you provide to:</p>
        <ul className="list-disc pl-6">
          <li>Send written estimates for the construction services you requested</li>
          <li>Schedule and confirm site visits</li>
          <li>Communicate about your active project (status updates, materials, scheduling)</li>
          <li>Follow up on estimates you have not yet responded to</li>
          <li>Respond to your questions and provide customer service</li>
          <li>Comply with legal obligations (permits, licensing, tax records)</li>
        </ul>

        <h2 className="text-xl font-bold pt-4">3. SMS Messaging Program</h2>
        <p>
          If you provide your mobile phone number, you may receive SMS text messages
          from us related to your estimate, scheduled visits, and active projects.
        </p>
        <ul className="list-disc pl-6">
          <li>
            <strong>Message frequency:</strong> You may receive up to 6 messages per
            month for an active project, depending on project status. Frequency is
            event-driven, not promotional.
          </li>
          <li>
            <strong>Message and data rates may apply.</strong> Standard text messaging
            rates from your wireless carrier may apply to messages you send to and
            receive from us.
          </li>
          <li>
            <strong>Opt-out:</strong> You can opt out of SMS messages at any time by
            replying <strong>STOP</strong> to any message. To resume messages later,
            reply <strong>START</strong>.
          </li>
          <li>
            <strong>Help:</strong> For help, reply <strong>HELP</strong> or call us at{" "}
            <a href="tel:+18572375602" className="underline">
              (857) 237-5602
            </a>
            .
          </li>
        </ul>

        <h2 className="text-xl font-bold pt-4">
          4. Mobile Information — No Sharing or Sale
        </h2>
        <p className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 font-medium">
          We do <strong>NOT</strong> share, sell, rent, or release your mobile phone
          number or SMS consent to any third party for marketing, promotional, or
          analytics purposes. Your mobile number is used solely to communicate with
          you about your JCN Construction project.
        </p>
        <p>
          This restriction also applies to our service providers: any vendor we use
          to send SMS messages (such as Twilio) is contractually bound to use your
          mobile number only to deliver the messages we authorize and may not use it
          for their own marketing.
        </p>

        <h2 className="text-xl font-bold pt-4">5. Other Disclosure</h2>
        <p>
          Aside from mobile phone numbers (Section 4), we may share other information
          you provide only with:
        </p>
        <ul className="list-disc pl-6">
          <li>
            <strong>Subcontractors</strong> directly involved in your project (e.g.,
            electricians, plumbers) when necessary to complete the work
          </li>
          <li>
            <strong>Town or city authorities</strong> when applying for required
            permits on your behalf
          </li>
          <li>
            <strong>Legal authorities</strong> when required by court order, subpoena,
            or applicable law
          </li>
        </ul>

        <h2 className="text-xl font-bold pt-4">6. Data Security</h2>
        <p>
          We use commercially reasonable physical, technical, and administrative
          measures to protect your information from unauthorized access, alteration,
          or destruction. No transmission over the internet is 100% secure; we
          cannot guarantee absolute security.
        </p>

        <h2 className="text-xl font-bold pt-4">7. Data Retention</h2>
        <p>
          We retain your contact and project information for as long as needed to
          provide our services, fulfill legal obligations, and resolve disputes.
          You may request deletion at any time by contacting us.
        </p>

        <h2 className="text-xl font-bold pt-4">8. Your Rights</h2>
        <p>You may at any time:</p>
        <ul className="list-disc pl-6">
          <li>Request a copy of the personal information we have about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your information</li>
          <li>Withdraw consent to SMS messages (reply STOP)</li>
        </ul>

        <h2 className="text-xl font-bold pt-4">9. Children</h2>
        <p>
          Our services are not directed to children under 13, and we do not knowingly
          collect personal information from anyone under 13.
        </p>

        <h2 className="text-xl font-bold pt-4">10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date at
          the top will reflect the most recent revision. Continued use of our
          services after changes constitutes acceptance of the updated policy.
        </p>

        <h2 className="text-xl font-bold pt-4">11. Contact Us</h2>
        <p>
          Questions about this Privacy Policy or our data practices?
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
        47 Rand St, Apt 1, Revere, MA 02151.
      </footer>
    </main>
  );
}
