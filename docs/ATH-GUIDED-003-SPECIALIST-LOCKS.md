# ATH-GUIDED-003 specialist locks

Verified against canonical Production on 2026-09-01. Ask validates each hub independently and treats a version or fingerprint mismatch as specialist unavailability, never as zero records.

| Hub | Production SHA | Version | Schema fingerprint | Contract fingerprint | Timeout |
| --- | --- | --- | --- | --- | --- |
| InvestorTrustHub | `7752cdc1a58c822d510f06180faf8dfea5889cde` | 2.0.0 | `a92b72c4a30de1021ecf25d26decb852b52394f741ac26919b89d14a234ab384` | `13c6d3a8e573b65490d50c88534bfcf604dfdeaed64fc0522ff7ef9c4b2b7efa` | 6 seconds |
| InsuranceTrustHub | `368fc11187665c29b610982174ade71efe81bfe5` | 2.0.0 | `4aa93bb372aebb45c7028b750000e77be4a847d9a210f3c40d3db1df1f7f637f` | `1292fd1ee4ce13a4d934dcb8c3deb21208d4e1e59049cbb8eb22793b310c1071` | 8 seconds |
| LenderTrustHub | `9f3979be002607532d1a170d7d7b01773d52d105` | 2.1.0 | `0da572d08450e68f4f01a4f4b28e2e813503f50b1a84546a29d7eb817db205dd` | `66d47651fc92ddec9866f7b37a36f67f0b9261daba27652f6753ce0d05ec3321` | 8 seconds |

All use `trusthub-specialist-execution-v2` at `/api/specialist-execution/v2`. Representative GET and POST responses were audited. The canonical cohort baselines observed were 438 New Jersey adviser firms, 56,939 Florida insurance agencies, and 214 FHA HMDA institutions for Broward County. Counts remain source-owned and are not hard-coded in Ask.

Insurance V2 currently does not advertise a compatible executable `life` line-of-authority value. Ask therefore renders a capability limitation for “Florida life insurance agencies”; it does not convert the rejected filter into a false zero, appointment claim, or unfiltered cohort.

Publication semantics remain specialist-owned. Ask does not mint profiles, expose restricted people or branches, query specialist databases, or persist specialist rows.
