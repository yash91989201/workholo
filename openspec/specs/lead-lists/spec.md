# lead-lists Specification

## Purpose

Lets an organization maintain reusable, validated lead lists for future campaign setup. Lists and leads remain scoped to their owning organization and retain stable records for later history.

## Requirements

### Requirement: Lead list management

Owners and administrators SHALL create and edit an organization-owned lead list with a required name and optional description. Only owners and administrators MAY create, edit, or archive lead lists.

#### Scenario: Administrator creates a list

- **WHEN** an administrator creates a lead list in the resolved organization with a valid name
- **THEN** the list is saved with that organization as its owner

#### Scenario: Agent cannot manage a list

- **WHEN** an agent attempts to create, edit, or archive a lead list
- **THEN** the request is rejected and no list changes

#### Scenario: List cannot be read across organizations

- **WHEN** a member requests a lead list owned by another organization
- **THEN** the request is rejected and no list data is returned

### Requirement: Lead entry and normalization

A lead SHALL belong to one lead list and contain a unique stable identifier, an explicit E.164 phone number, and an optional name. The system MUST normalize accepted phone formatting to canonical E.164 and MUST NOT infer a country code.

#### Scenario: Manually add a lead

- **WHEN** an owner or administrator adds a lead with a valid explicit international number and optional name
- **THEN** the lead is saved with the number in canonical E.164 form

#### Scenario: Number without explicit country code is rejected

- **WHEN** a lead is submitted with a number that cannot be validated as E.164 without guessing a country code
- **THEN** the lead is rejected with a validation result and is not saved

#### Scenario: Duplicate number in one list is rejected

- **WHEN** a lead is added with a canonical E.164 number already present in that list
- **THEN** the addition is rejected as a duplicate and the existing lead remains unchanged

### Requirement: CSV lead import

Owners and administrators SHALL import CSV rows containing a phone number and optional name, and the import result MUST identify the outcome of every submitted row. A row with an invalid number or a number duplicated within the list MUST NOT create a lead.

#### Scenario: Import valid rows

- **WHEN** a CSV import contains valid numbers not already in the list
- **THEN** each valid row creates one lead with a canonical E.164 number and the result identifies each row as imported

#### Scenario: Report invalid and duplicate rows

- **WHEN** a CSV import contains malformed numbers, existing list numbers, or repeated numbers in the same file
- **THEN** every affected row is reported as rejected with its row number and reason, and no rejected row creates a lead

#### Scenario: Import results remain row-specific

- **WHEN** a CSV import contains both valid and rejected rows
- **THEN** each row's result is reported independently and valid rows are not hidden by other row errors

### Requirement: Lead removal and list archival

Removing a lead or archiving a list SHALL make it unavailable for future campaign setup while preserving stable records for future historical references. Archived lists MUST NOT be offered as active setup options.

#### Scenario: Remove a lead

- **WHEN** an owner or administrator removes a lead from an active list
- **THEN** the lead is unavailable for future use and its stable record remains available to preserve later history references

#### Scenario: Archive a list

- **WHEN** an owner or administrator archives a lead list
- **THEN** the list and its leads are unavailable for future use while their stable records remain preserved

#### Scenario: Future setup lists only active lists

- **WHEN** an authorized console user requests lead list options for future campaign setup
- **THEN** the response includes only active lists belonging to the resolved organization
