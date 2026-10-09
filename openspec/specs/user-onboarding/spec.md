# user-onboarding Specification

## Purpose

Menyediakan panduan interaktif, launchpad ramah pengguna baru pada kondisi tanpa data, kartu aksi cepat coba prompt AI, serta pusat tutorial fitur PWA Share Target dan OCR struk untuk mempercepat adopsi pengguna.

## Requirements

### Requirement: Interactive Zero-Data State Launchpad
The system SHALL display an interactive Onboarding Launchpad in the transaction view when a user has no recorded transactions and no active search or filter queries, replacing the generic empty-state text. When at least one transaction exists, the system SHALL display the regular transaction list and statistics.

#### Scenario: New user views empty transaction list
- **WHEN** user opens the application with zero total transactions and no filter or search applied
- **THEN** system SHALL render the Onboarding Launchpad displaying the welcome greeting, quick-try prompt chips, and core feature discovery cards

#### Scenario: User records their first transaction
- **WHEN** user successfully records their first transaction
- **THEN** system SHALL automatically hide the Onboarding Launchpad and display the transaction within the standard transaction list

#### Scenario: User applies filters with no matching transactions
- **WHEN** user who already has transactions applies a search term, category filter, or date filter that yields 0 matching transactions
- **THEN** system SHALL display the standard filter empty state ("Tidak ada transaksi yang cocok dengan filter") rather than the Onboarding Launchpad

### Requirement: Quick-Try Sample Expense Prompt Chips
The system SHALL provide interactive sample expense chips within the Onboarding Launchpad allowing users to test AI transaction parsing with one tap.

#### Scenario: User clicks a sample expense chip
- **WHEN** user clicks on any sample expense chip (such as "Kopi susu 18rb" or "Makan siang padang 25rb")
- **THEN** system SHALL open the AI Chat Drawer with the chosen sample prompt prefilled in the message input field

### Requirement: On-Demand Feature Guide Hub
The system SHALL provide an on-demand Feature Guide Modal accessible at any time from both the top navigation bar and the user profile settings, presenting comprehensive walkthroughs of application capabilities.

#### Scenario: User opens feature guide from navigation header
- **WHEN** user clicks the Help/Panduan icon button in the top navigation header
- **THEN** system SHALL open the Feature Guide Modal with category tabs for PWA Share Target, AI Chat/Voice, Receipt OCR, Debt/Split-bill, and Gemini API keys

#### Scenario: User opens feature guide from Profile Modal
- **WHEN** user clicks the "Panduan & Tutorial Fitur" action button inside the Profile Modal
- **THEN** system SHALL open the Feature Guide Modal

### Requirement: PWA and QRIS Share Target Walkthrough
The system SHALL provide clear visual step-by-step instructions for installing the app as a Progressive Web App (PWA) on Android and iOS, and sharing digital receipts directly from banking applications (e.g. BCA, Mandiri, BRI, e-wallets) to Akuntan AI.

#### Scenario: User inspects PWA and QRIS sharing instructions
- **WHEN** user selects the QRIS / PWA section from the Onboarding Launchpad or Feature Guide Modal
- **THEN** system SHALL display step-by-step guidance illustrating: 1) Add to Home Screen, 2) Complete payment in m-Banking, 3) Tap Share receipt, and 4) Select Akuntan AI from the OS share sheet
