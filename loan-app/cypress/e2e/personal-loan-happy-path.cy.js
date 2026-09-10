/**
 * P0 test #1 from the 15-journey suite (see README §Testing).
 * Demonstrates the custom-command pattern the remaining 14 journeys reuse:
 * fillStep1..fillStep8, plus shared fixtures under cypress/fixtures/.
 */
describe("Personal loan — happy path", () => {
  beforeEach(() => cy.visit("/"));

  it("completes a salaried personal loan application end to end", () => {
    cy.fixture("valid-personal-loan.json").then((data) => {
      cy.fillStep1(data.step1);
      cy.contains("button", "Continue").click();

      cy.fillStep2(data.step2);
      cy.contains("button", "Continue").click();

      cy.fillStep3Kyc(data.step3);
      cy.contains("[aria-label='Verified']", { timeout: 3000 }).should("exist");
      cy.get("#aadhaarConsent").check();
      cy.contains("button", "Continue").click();

      cy.fillStep4Address(data.step4);
      cy.contains("button", "Continue").click();

      cy.fillStep5Employment(data.step5);
      cy.contains("button", "Continue").click();

      // Step 6 (co-applicant) is skipped for personal loans under the threshold
      cy.uploadAllDocuments();
      cy.signCanvas();
      cy.contains("button", "Continue").click();

      cy.get("#consent-accurate").check();
      cy.get("#consent-creditCheck").check();
      cy.get("#consent-terms").check();
      cy.get("#consent-communication").check();
      cy.contains("button", "Submit application").click();

      cy.contains("Application submitted").should("be.visible");
      cy.contains(/LS\d{8}\d{3}/).should("be.visible");
    });
  });
});
