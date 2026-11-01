@checkout
Feature: Checkout login
  As a shopper
  I want to log in when I check out
  So that my order is linked to my account

  Background:
    Given the app is launched on the catalog screen
    And the cart contains "Sauce Labs Backpack - Black"

  @smoke
  Scenario: Log in to continue checkout
    When I proceed to checkout
    And I log in as "bob@example.com"
    Then the shipping address screen should be shown

  Scenario: Login requires a username
    When I proceed to checkout
    And I tap Login without entering credentials
    Then I should see a "Validation Error!" alert saying "Username is required"
