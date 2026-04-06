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
        heading: "How does the service fee work?",
        body: "Jali charges a small service fee of 300–500 RWF per booking based on your distance to the nearest bus station. This fee covers our operational costs and is shown clearly before you confirm payment.",
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
        body: "Go to Profile and toggle on Driver Mode. You will be able to offer private seats on your regular routes and earn money from passengers. Your vehicle details and zone can be set in the Driver Dashboard.",
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
        heading: "4. Service Fee",
        body: "A non-refundable service fee of 300–500 RWF is charged per booking. This fee covers platform costs and is disclosed before payment.",
      },
      {
        heading: "5. Cancellations & Refunds",
        body: "Bus bookings cancelled more than 24 hours before departure are eligible for a refund of the ticket price (service fee excluded). Private seat bookings are non-refundable once confirmed. Car rentals are non-refundable within 12 hours of the rental start.",
      },
      {
        heading: "6. Driver Responsibilities",
        body: "Drivers who offer private seats via Jali are independent operators. They are responsible for their vehicle's roadworthiness, insurance, and compliance with Rwandan transport regulations.",
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
        body: "We collect your phone number or Google account email (for sign-in), your name, your approximate location (to calculate the service fee), your booking history, and your device's push notification token (to send you booking updates).",
      },
      {
        heading: "How we use your data",
        body: "Your data is used to: process and manage your bookings, calculate the distance-based service fee, send push notifications about your bookings, and improve the Jali service. We do not sell your data to third parties.",
      },
      {
        heading: "Location",
        body: "Jali requests your location only to estimate the service fee based on your distance to the nearest bus station. Location is not stored on our servers and is not shared with third parties.",
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
