# Elemetric Email Templates

These HTML files are branded email templates for Supabase Auth. Paste them directly into the Supabase Dashboard.

## How to Use

1. Open the [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication → Email Templates**
4. Select the template type (e.g. "Confirm signup")
5. Copy the full HTML from the corresponding file below
6. Paste into the template editor
7. Click **Save**

## Template Files

| File | Supabase Template Type |
|------|----------------------|
| `signup-confirmation.html` | Confirm signup |
| `password-reset.html` | Reset Password |
| `magic-link.html` | Magic Link |
| `email-change.html` | Change Email Address |

## Notes

- All templates use the `{{ .ConfirmationURL }}` variable which Supabase replaces with the actual link
- The ABN (19 377 661 368) and links are pre-filled
- Elemetric brand colours: Orange `#f97316`, Navy `#07152B`, Card `#0d1f3c`
