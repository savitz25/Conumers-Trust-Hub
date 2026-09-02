# ATH-CUST-013A Investor dependency lock

AskTrustHub validates Investor customer claims against the Production-only
`investor-customer-claim-validation-v1` contract. Version `1.0.0`, schema
fingerprint `51d41f55eb6ff85f1ecf85e8feb0742647e6d50c730ad37859cd9918625018f3`,
and contract fingerprint
`80cc14c9d9756972d87aaf3a51ac2336888a9dc77048d3d3c298343b25086032`
must all match before Ask accepts a result.

Customer identity is one exact canonical firm: Investor `firms.id` UUID,
organization CRD, and canonical public profile URL. RIA and ERA remain
regulatory evidence on that firm, not separate customer identities.
Representatives, research-only firms, unpublished firms, fuzzy/name matches,
and contract drift fail closed. This validation does not establish claimant
ownership or control. Investor monitoring and the specialist claim CTA remain
disabled.
