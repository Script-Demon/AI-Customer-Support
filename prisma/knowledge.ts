// Knowledge base for "Nimbus", a fictional consumer electronics store used by the seed.

export const KNOWLEDGE_DOCS: { title: string; category: string; content: string }[] = [
  {
    title: "Return Policy",
    category: "Refund Policy",
    content: `Products can be returned within 30 days of delivery for a full refund. Items must be unused, in their original packaging, and include all accessories and manuals.

To start a return, reply with your order number and we will email you a prepaid return label. Return shipping is free for defective, damaged, or incorrect items. For change-of-mind returns a $6.95 return shipping fee is deducted from the refund.

Returns requested more than 30 days after delivery are not eligible for a refund. Products that develop a fault after 30 days are covered by the 1-year limited warranty instead (repair or replacement).

Exchanges for a different color or size are free within 30 days of delivery. Clearance items marked "Final Sale" cannot be returned unless they arrive defective.`,
  },
  {
    title: "Refund Processing",
    category: "Refund Policy",
    content: `Once a returned item arrives at our warehouse it is inspected within 2 business days. Approved refunds are issued to the original payment method and typically appear within 5-7 business days, depending on the bank.

If the original payment method is no longer available, the refund is issued as Nimbus store credit, which never expires.

Partial refunds may be issued for items returned with missing accessories or signs of use.

Duplicate charges: if a customer sees two charges for one order, one is usually a pending authorization that disappears automatically within 3-5 business days. If both charges have posted, the duplicate is refunded immediately after the agent verifies it in the billing system.`,
  },
  {
    title: "Shipping Policy",
    category: "Shipping Policy",
    content: `Orders are processed within 1-2 business days. Standard shipping takes 3-7 business days after dispatch; Express shipping takes 1-2 business days. International orders take 7-14 business days and may be subject to import duties.

Standard shipping is free on orders over $50. Otherwise standard shipping costs $5.95 and Express costs $14.95.

A tracking link is emailed as soon as the order ships. Tracking can take up to 24 hours to show the first scan.

Delayed orders: if tracking has not updated for 5 business days, we open an investigation with the carrier. If an order has not been delivered within 10 business days of dispatch, we will send a free replacement with Express shipping or issue a full refund, whichever you prefer.

Packages marked as delivered but not received: ask the customer to check with neighbours and their building's mailroom, then wait 48 hours, as carriers sometimes mark parcels delivered early. After 48 hours we open a lost-package claim and ship a replacement.`,
  },
  {
    title: "Frequently Asked Questions",
    category: "FAQ",
    content: `Can I change or cancel my order? Orders can be changed or cancelled within 1 hour of being placed. After that the order is already being packed; the customer can refuse delivery or return it within 30 days instead.

Which payment methods do you accept? Visa, Mastercard, American Express, PayPal, Apple Pay and Google Pay. Nimbus gift cards can be combined with any payment method.

Do you price match? Yes. If an identical item is sold for less by an authorized retailer within 14 days of purchase, we refund the difference.

My promo code doesn't work. Promo codes cannot be combined, exclude clearance items, and are case-sensitive. Expired codes cannot be reactivated.

Do you ship to P.O. boxes? Standard shipping can deliver to P.O. boxes; Express shipping cannot.`,
  },
  {
    title: "Nimbus Plus Subscription & Billing",
    category: "FAQ",
    content: `Nimbus Plus costs $4.99 per month or $49 per year and includes cloud video storage for Nimbus Cam (30 days of history), extended 2-year warranty on new purchases, and free Express shipping.

Subscriptions renew automatically. Customers can cancel at any time from Account > Subscriptions; access continues until the end of the paid period. Annual plans cancelled within 14 days of renewal are refunded in full.

Invoices are available under Account > Billing and are emailed after every payment.

If a renewal payment fails we retry three times over 7 days before pausing the subscription. Recorded clips are kept for 30 days after a subscription is paused.`,
  },
  {
    title: "Account Help",
    category: "Account Help",
    content: `Password reset: use "Forgot password" on the sign-in page. The reset link is valid for 1 hour. If the email doesn't arrive within 10 minutes, check spam or ask an agent to resend it.

Locked accounts: after 5 failed sign-in attempts the account is locked for 30 minutes for security. Agents can unlock it sooner after verifying the customer's identity (email on file plus last order number).

Two-factor authentication (2FA): can be enabled under Account > Security. If the customer has lost their 2FA device, an agent must verify identity before 2FA can be reset; this takes up to 24 hours.

Changing the account email: Account > Profile. A confirmation link is sent to both the old and new address.

Compromised account: if a customer reports suspicious orders or a hacked account, immediately escalate to the Trust & Safety team, lock the account, and cancel any unshipped orders. Never ask the customer for their password.

Deleting an account: requests are processed within 30 days in line with our privacy policy.`,
  },
  {
    title: "Nimbus Buds Pro — Product Guide",
    category: "Product Documentation",
    content: `Nimbus Buds Pro are wireless earbuds with active noise cancellation (ANC), Bluetooth 5.3 and an IPX4 water resistance rating (sweat and splash resistant, not waterproof).

Battery: up to 8 hours of playback per charge (6 hours with ANC on), plus 32 hours total with the charging case. A 10-minute charge gives about 1 hour of playback. The case charges via USB-C or any Qi wireless charger.

Pairing: open the case near the device, press and hold the case button for 3 seconds until the light flashes white, then select "Nimbus Buds Pro" in Bluetooth settings. Multipoint lets the buds connect to two devices at once.

Compatibility: works with any Bluetooth device. The Nimbus app (iOS 15+ and Android 10+) adds EQ settings, firmware updates and Find My Buds.

In the box: earbuds, charging case, USB-C cable, ear tips in sizes S, M, L.`,
  },
  {
    title: "Nimbus Hub & Nimbus Cam — Product Guide",
    category: "Product Documentation",
    content: `Nimbus Hub is a smart home controller that supports Wi-Fi, Zigbee and Matter devices. It requires a 2.4 GHz Wi-Fi network for setup; 5 GHz-only networks are not supported.

Nimbus Cam is an indoor 2K security camera with night vision, two-way audio and motion alerts. Live view is free. Recorded clip history requires a Nimbus Plus subscription; without it, motion alerts include a snapshot only.

Both devices are set up through the Nimbus app: tap "Add device", scan the QR code on the device, and follow the steps.

Warranty: all Nimbus hardware includes a 1-year limited warranty covering manufacturing defects (2 years with Nimbus Plus). Accidental damage, water damage beyond the rated protection, and normal battery wear are not covered. Warranty claims require the order number and a short description or video of the fault; approved claims receive a free replacement.`,
  },
  {
    title: "Troubleshooting Guide",
    category: "Troubleshooting",
    content: `Buds won't pair or only one earbud plays: place both buds in the case, close the lid for 10 seconds, then press and hold the case button for 15 seconds until the light flashes amber three times. This resets the buds. Then forget "Nimbus Buds Pro" in Bluetooth settings and pair again.

Buds battery drains quickly: update to the latest firmware in the Nimbus app (Settings > Firmware). Firmware 2.4.1 fixed a battery drain bug affecting standby. Turning off ANC extends battery life by about 25%.

Hub won't connect to Wi-Fi: make sure the phone is on the 2.4 GHz band during setup, move the Hub within 5 metres of the router, and check the Wi-Fi password. Hold the reset button for 10 seconds to restart setup.

Cam shows "Offline": power-cycle the camera, confirm the router is online, and check the camera is within range. If the light is solid red, the camera has lost Wi-Fi credentials; re-add it in the app.

App crashes on launch: update the app to the latest version, restart the phone, and if it still crashes, reinstall. Settings are stored in the cloud and are restored after signing in.

If none of these steps work, collect the device model, firmware version and a description of the issue and escalate to the Technical Support team.`,
  },
]
