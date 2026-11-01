@cart
Feature: Shopping cart
  As a shopper
  I want to add products to my cart
  So that I can buy them

  Background:
    Given the app is launched on the catalog screen

  @smoke
  Scenario: Add a backpack to the cart
    When I open the product "Sauce Labs Backpack - Black"
    And I add the product to the cart
    And I open the "Cart" tab
    Then the cart should contain 1 item
    And the cart should list "Sauce Labs Backpack - Black"

  @smoke
  Scenario: Remove a backpack from the cart
    Given the cart contains "Sauce Labs Backpack - Black"
    When I remove "Sauce Labs Backpack - Black" from the cart
    Then the cart should not list "Sauce Labs Backpack - Black"
    And the cart should be empty
  
  @smoke
  Scenario: Add multiple products to the cart
    When I open the product "Sauce Labs Backpack - Black"
    And I add the product to the cart
    When I open the product "Sauce Labs Bolt T-Shirt - Red"
    And I add the product to the cart
    And I open the "Cart" tab
    Then the cart should contain 2 items
    And the cart should list "Sauce Labs Backpack - Black"
    And the cart should list "Sauce Labs Bolt T-Shirt - Red"

  @smoke
  Scenario: Add the bike light
    When I open the product "Sauce Labs Bike Light"
    And I add the product to the cart
    And I open the "Cart" tab
    Then the cart should contain 1 item

  @smoke
  Scenario: Add and Remove the bike light
    When I open the product "Sauce Labs Bike Light"
    And I add the product to the cart
    And I open the "Cart" tab
    Then the cart should contain 1 item
    When I remove "Sauce Labs Bike Light" from the cart
    Then the cart should be empty
