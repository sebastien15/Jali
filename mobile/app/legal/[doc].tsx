import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/theme";

const CONTENT: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  faq: {
    title: "FAQ",
    sections: [
      {
        heading: "How do I book a bus?",
        body: "Open the Home tab, select your departure city, destination, and travel date. Choose a bus from the list and tap Book. An admin will confirm your booking and upload your ticket photo within a few hours.",
      },
      {
        heading: "Does Jali charge a fee?",
        body: "No. Jali charges no booking or service fees. Transport prices are set by the bus companies, drivers and car owners, and you pay exactly the price shown before you confirm.",
      },
      {
        heading: "When will I receive my ticket?",
        body: "After you book, our team manually contacts the bus agency and obtains a physical ticket. We photograph the ticket and upload it to your booking — usually within 2–4 hours. You will receive a push notification when it's ready.",
      },
      {
        heading: "Can I cancel my booking?",
        body: "Bus bookings can be cancelled up to 24 hours before departure for a refund. Private seat bookings are non-refundable — the driver reserves the seat upfront. Car rental cancellations depend on the rental period remaining.",
      },
      {
        heading: "What payment methods are supported?",
        body: "We currently support MTN Mobile Money, Airtel Money, and bank card. Payment integration will be available in a future update. Bookings are currently confirmed after manual payment verification.",
      },
      {
        heading: "How do I become a driver?",
        body: "Driver accounts are approved by Jali. Contact us through Help & Support in your Profile; once your account is approved you can switch on Driver Mode, offer private seats on your regular routes and set your vehicle details in the Driver Dashboard.",
      },
      {
        heading: "How do I contact support?",
        body: "Tap Help & Support in your Profile. You can reach us via WhatsApp or call during business hours (8am–6pm, Monday–Saturday). We aim to respond within 1 hour.",
      },
      {
        heading: "Is Jali available outside Kigali?",
        body: "Yes. Jali covers routes between Kigali, Musanze, Huye, Rubavu, Nyagatare, Rwamagana, Muhanga, and Rusizi. More cities will be added based on demand.",
      },
    ],
  },

  "hire-terms": {
    title: "Hire a Driver — Terms",
    sections: [
      {
        heading: "1. What you are booking",
        body: "You book a verified Jali driver to drive your own car (or a car you rented) for the hours or days you chose. Jali connects you with the driver; the driver provides the driving service.",
      },
      {
        heading: "2. Your car",
        body: "The car must be roadworthy, insured, and have valid papers (registration card, insurance, technical inspection). Tell the driver about anything unusual (manual gearbox, warning lights, child seats) before the start.",
      },
      {
        heading: "3. Fuel, tolls and parking",
        body: "You pay for fuel, parking, tolls and car washes. They are not included in the price shown in the app.",
      },
      {
        heading: "4. Damage, fines and accidents",
        body: "Your car insurance covers the car. The driver is responsible for driving carefully and following the traffic code; traffic fines caused by the driver's driving are the driver's responsibility. Report any accident or damage in the app the same day. Jali helps both sides with evidence (times, route, ratings) but is not the insurer.",
      },
      {
        heading: "5. Meals and out-of-town trips",
        body: "For bookings longer than 6 hours you give the driver a meal break or pay for a meal. Trips outside Kigali include the driver's out-of-town fee per day; for overnight trips you also provide or pay for the driver's accommodation.",
      },
      {
        heading: "6. Time, overtime and payment",
        body: "The price is locked when you book. If the driver works past the booked time, overtime is charged at the driver's overtime rate after a short grace period. You pay the driver in cash or MoMo at the end, as shown in the app.",
      },
      {
        heading: "7. Cancellation",
        body: "You can cancel free of charge while the request is waiting and until 3 hours before the start. Later cancellations cost a share of the driver's price, shown in the app before you confirm. Drivers who cancel are reviewed by Jali.",
      },
      {
        heading: "8. No-shows and disputes",
        body: "If the other side has not come 30 minutes after the start, either of you can report a no-show in the app and the hire ends. If the driver does not come, you pay nothing. If you do not show, the late-cancellation share of the driver's price applies. If the recorded hours look wrong, either side can dispute them from the hire for 7 days; Jali reviews the timeline and tells you both the outcome. Jali takes no fee on hires.",
      },
      {
        heading: "9. Safety",
        body: "Drivers are identity- and licence-checked before they can be hired. You can see the driver's name, photo, rating and phone number once they accept. Never hand over your car to someone whose name and photo do not match the app.",
      },
    ],
  },

  terms: {
    title: "Terms & Conditions",
    sections: [
      {
        heading: "1. Acceptance",
        body: "By using Jali, you agree to these Terms. If you do not agree, please do not use the app. These terms apply to all users including passengers, drivers, and admins.",
      },
      {
        heading: "2. Eligibility",
        body: "You must be at least 18 years old to use Jali. By creating an account you confirm that you meet this requirement.",
      },
      {
        heading: "3. Bookings",
        body: "Jali acts as a booking intermediary. We manually arrange transport on your behalf through partner agencies and independent drivers. Confirmation is subject to availability.",
      },
      {
        heading: "4. Fees",
        body: "Jali charges no booking or service fees. Prices are set by the transport providers and shown in full before you confirm.",
      },
      {
        heading: "5. Cancellations & Refunds",
        body: "Bus bookings cancelled more than 24 hours before departure are eligible for a refund of the ticket price. Private seat bookings are non-refundable once confirmed. Car rentals are non-refundable within 12 hours of the rental start.",
      },
      {
        heading: "6. Driver Responsibilities",
        body: "Drivers who offer private cars via Jali are independent operators. They are responsible for their vehicle's roadworthiness, insurance, and compliance with Rwandan transport regulations.",
      },
      {
        heading: "7. Prohibited Use",
        body: "You may not use Jali for any unlawful purpose, to harass other users, to submit false bookings, or to attempt to access another user's account.",
      },
      {
        heading: "8. Limitation of Liability",
        body: "Jali is not liable for delays, cancellations, or incidents caused by third-party transport operators. We facilitate bookings but do not operate the vehicles.",
      },
      {
        heading: "9. Changes to Terms",
        body: "We may update these Terms at any time. Continued use of the app after changes constitutes acceptance. We will notify you of significant changes via push notification.",
      },
      {
        heading: "10. Governing Law",
        body: "These Terms are governed by the laws of the Republic of Rwanda.",
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "What we collect",
        body: "We collect your phone number or Google account email (for sign-in), your name, your approximate location (to show nearby rides and stations), your booking history, and your device's push notification token (to send you booking updates).",
      },
      {
        heading: "How we use your data",
        body: "Your data is used to: process and manage your bookings, show nearby rides and stations, send push notifications about your bookings, and improve the Jali service. We do not sell your data to third parties.",
      },
      {
        heading: "Location",
        body: "Jali requests your location only to show nearby rides, drivers and stations. Location is not stored on our servers and is not shared with third parties.",
      },
      {
        heading: "Firebase",
        body: "Jali uses Google Firebase for authentication and push notifications. Firebase may process your phone number or email address on Google's servers. See Google's Privacy Policy for details.",
      },
      {
        heading: "Data storage",
        body: "Your account data and booking records are stored on our secure servers hosted in the European Union (Hetzner). Ticket photos are stored in Google Firebase Storage.",
      },
      {
        heading: "Data retention",
        body: "Your data is retained for as long as your account exists. When you delete your account, your personal information is permanently removed within 30 days. Anonymised booking records may be kept for statistical purposes.",
      },
      {
        heading: "Your rights",
        body: "You have the right to access, correct, or delete your personal data at any time. You can delete your account directly in the app under Profile → Delete Account. For other requests, contact us at privacy@jali.rw.",
      },
      {
        heading: "Children",
        body: "Jali is not intended for users under 18. We do not knowingly collect data from minors.",
      },
      {
        heading: "Contact",
        body: "For privacy questions, contact us at privacy@jali.rw or write to: Jali, Kigali, Rwanda.",
      },
      {
        heading: "Last updated",
        body: "This policy was last updated on April 6, 2026.",
      },
    ],
  },
};

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = CONTENT[doc ?? "faq"] ?? CONTENT.faq;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.blue, flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingVertical: 16, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={{ color: C.white, fontWeight: "900", fontSize: 20 }}>
          {content.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        {content.sections.map((s, i) => (
          <View key={i}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: C.dark, marginBottom: 6 }}>
              {s.heading}
            </Text>
            <Text style={{ color: C.mid, fontSize: 14, lineHeight: 22 }}>
              {s.body}
            </Text>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
