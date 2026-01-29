
// scripts/hdid/selectors.ts
export const selectors = {
  // Login
  signInLink: 'role=link[name="Sign in"], role=button[name="Sign in"], text=/Sign in/i',
  emailInput: 'input[type="email"], [placeholder="Email"], input[name="email"]',
  passwordInput: 'input[type="password"], [placeholder="Password"], input[name="password"]',
  signInButton: 'role=button[name=/Sign in|Log in|Login/i]',
  acceptCookies: 'role=button[name=/Accept( all)? cookies/i], text=/Accept All/i',
  // Navigation
  bookingsNav: 'role=link[name=/Bookings|Tee Times|Book/i], role=button[name=/Book/i]',
  clubPicker: 'role=combobox[name=/Club/i], [data-test="club-select"]',
  coursePicker: 'role=combobox[name=/Course/i], [data-test="course-select"]',
  datePicker: 'role=button[name=/Date|Calendar/i], input[type="date"]',
  // Time grid
  timeCell: (timeHHmm: string) => `role=button[name=/^\\s*${timeHHmm}\\s*$/i], text=/^\\s*${timeHHmm}\\s*$/`,
  playersPicker: 'role=combobox[name=/Players/i], [data-test="players-select"]',
  confirmButton: 'role=button[name=/Confirm|Continue|Book/i]',
  finaliseButton: 'role=button[name=/Pay|Confirm|Finish/i]',
  // Post-booking
  successToast: 'text=/Booking confirmed|Success|Thank you/i'
};
