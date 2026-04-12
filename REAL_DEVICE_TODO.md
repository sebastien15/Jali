# Real Device TODO

Things removed or simplified for web compatibility that need to be restored when running on a real iOS/Android device.

---

## 1. Logout confirmation dialog
**File:** `mobile/app/(tabs)/profile.tsx` — `handleLogout()`

`Alert.alert` does nothing on web so we call `doLogout()` directly. On a real device, restore the confirmation:

```ts
function handleLogout() {
  Alert.alert("Log Out", "Are you sure you want to log out?", [
    { text: "Cancel", style: "cancel" },
    { text: "Log Out", style: "destructive", onPress: () => doLogout() },
  ]);
}
```

---

## 2. Delete account confirmation dialog
**File:** `mobile/app/(tabs)/profile.tsx` — `handleDeleteAccount()`

Same issue. On a real device, restore the destructive confirmation:

```ts
function handleDeleteAccount() {
  Alert.alert(
    "Delete Account",
    "This will permanently delete your account and all your data. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Everything", style: "destructive", onPress: () => doDeleteAccount() },
    ],
  );
}
```

Also restore the error alert inside `doDeleteAccount`:
```ts
} catch (e: any) {
  const msg = e?.response?.data?.message ?? "Failed to delete account. Please try again.";
  Alert.alert("Error", msg);
}
```

---

## 3. Admin booking action confirmation dialogs
**File:** `mobile/app/(admin)/bookings/index.tsx` — `handleStatusChange()`

Currently calls `doStatusChange()` directly (no confirmation). On a real device, add confirmation back:

```ts
function handleStatusChange(id: number, status: string, label: string) {
  Alert.alert(label, `${label}?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Yes", onPress: () => doStatusChange(id, status) },
  ]);
}
```

And pass `label` back into `renderActions` calls.

---

## 4. Date picker
**File:** `mobile/app/(tabs)/index.tsx`

`@react-native-community/datetimepicker` is not supported on web — shows a console warning and no UI. On a real device it will work correctly as-is (wrapped in a Modal with "Done" button on iOS, native dialog on Android). No code change needed — just verify it visually on device.

---

## 5. Driver Mode toggle alert
**File:** `mobile/app/(tabs)/profile.tsx` — `handleDriverToggle()`

This one still uses `Alert.alert` to ask "Private trips or Rental cars?" — same web limitation applies. Consider testing this flow on device.
