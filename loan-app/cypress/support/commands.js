Cypress.Commands.add("fillStep1", (d) => {
  cy.contains(d.loanTypeLabel).click();
  cy.get("#step-first-field").type(d.amount);
  cy.get("#loanTenure").select(d.tenure);
  cy.get("#loanPurpose").select(d.purpose);
});

Cypress.Commands.add("fillStep2", (d) => {
  cy.get("#step-first-field").type(d.fullName);
  cy.get("#dob").type(d.dob);
  cy.get("#gender").select(d.gender);
  cy.get("#maritalStatus").select(d.maritalStatus);
  cy.get("#fatherName").type(d.fatherName);
  cy.get("#motherName").type(d.motherName);
  cy.get("#email").type(d.email);
  cy.get("#mobile").type(d.mobile);
});

Cypress.Commands.add("fillStep3Kyc", (d) => {
  cy.get("#step-first-field").type(d.pan);
  cy.get("#aadhaar").type(d.aadhaar);
});

Cypress.Commands.add("fillStep4Address", (d) => {
  cy.get("#step-first-field").type(d.address1);
  cy.get("#pincode").type(d.pincode);
  cy.get("#residenceType").select(d.residenceType);
  cy.get("#yearsAtAddress").type(d.years);
});

Cypress.Commands.add("fillStep5Employment", (d) => {
  cy.contains(d.employmentLabel).click();
  cy.get("#companyName").type(d.companyName);
  cy.get("#designation").type(d.designation);
  cy.get("#monthlySalary").type(d.monthlySalary);
  cy.get("#yearsExperience").type(d.yearsExperience);
});

Cypress.Commands.add("uploadAllDocuments", () => {
  cy.get("input[type=file]").each(($el) => {
    cy.wrap($el).selectFile("cypress/fixtures/sample-doc.pdf", { force: true });
  });
});

Cypress.Commands.add("signCanvas", () => {
  cy.get("canvas")
    .trigger("mousedown", { clientX: 60, clientY: 60 })
    .trigger("mousemove", { clientX: 120, clientY: 90 })
    .trigger("mouseup");
});
