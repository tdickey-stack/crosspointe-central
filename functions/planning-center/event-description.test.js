import assert from "node:assert/strict";
import test from "node:test";

import {parseEventDescription} from "./event-description.js";

const signupUrl = "https://crosspointetv.churchcenter.com/people/forms/1309469";

test("extracts the booth CTA and retains the ordinary inline link", () => {
  const parsed = parseEventDescription(`<p><strong>Trunk or Treat</strong></p>
    <p>Join us <strong>October 28, 2026</strong>.</p>
    <p><a href="${signupUrl}">Register your booth</a>, or contact Angie.</p>
    <p>{button_text:"Register Your Booth"|button_link:"${signupUrl}"}</p>`);

  assert.equal(parsed.registration_url, signupUrl);
  assert.equal(parsed.registration_button_text, "Register Your Booth");
  assert.ok(!parsed.cta_warning);
  assert.match(parsed.description_html, /<strong>October 28, 2026<\/strong>/);
  assert.ok(parsed.description_html.includes(`href="${signupUrl}"`));
  assert.match(parsed.description, /Register your booth, or contact Angie\./);
  assert.doesNotMatch(parsed.description, /button_text|button_link|<\/?p>/);
  assert.doesNotMatch(parsed.description_html, /button_text|button_link/);
});

for (const [name, left, right] of [
  ["single", "'", "'"],
  ["double", "\"", "\""],
  ["curly double", "“", "”"],
  ["curly single", "‘", "’"],
]) {
  test(`accepts ${name} quotation marks in the CTA marker`, () => {
    const parsed = parseEventDescription(
        `{button_text:${left}Register Your Booth${right}|` +
        `button_link:${left}${signupUrl}${right}}`,
    );
    assert.equal(parsed.registration_url, signupUrl);
    assert.equal(parsed.registration_button_text, "Register Your Booth");
    assert.equal(parsed.description, "");
    assert.ok(!parsed.cta_warning);
  });
}

test("handles auto links, formatted keys, and encoded characters", () => {
  const parsed = parseEventDescription(`<p>Everyone is welcome.</p>
    <p>{button_<strong>text</strong>:&quot;Host &amp; Serve&quot;|
    button_link:&quot;<a href="${signupUrl}?a=1&amp;b=2">` +
    `${signupUrl}?a=1&amp;b=2</a>&quot;}</p>`);

  assert.equal(parsed.registration_button_text, "Host & Serve");
  assert.equal(parsed.registration_url, `${signupUrl}?a=1&b=2`);
  assert.equal(parsed.description, "Everyone is welcome.");
  assert.doesNotMatch(parsed.description_html, /button_|Host|forms\/1309469/);
});

test("informational copy keeps readable paragraphs and lists", () => {
  const parsed = parseEventDescription(`<p>Welcome &amp; connect.</p>
    <p>Bring:</p><ul><li>Candy</li><li>A friendly face</li></ul>
    <p>See you soon.<br>Doors open at six.</p>`);

  assert.ok(!parsed.registration_url);
  assert.ok(!parsed.registration_button_text);
  assert.ok(!parsed.cta_warning);
  assert.match(parsed.description, /Welcome & connect\.\s+Bring:/);
  assert.match(parsed.description, /Candy\n\s*[^\n]*A friendly face/);
  assert.match(parsed.description, /See you soon\.\nDoors open at six\./);
  assert.match(parsed.description_html,
      /<ul><li>Candy<\/li><li>A friendly face<\/li><\/ul>/);
});

test("sanitizes markup while keeping emphasis and safe links", () => {
  const parsed = parseEventDescription(`
    <p style="color:red" onclick="evil()">Hello
    <b>bold</b> <i>italic</i> <em>emphasis</em> <u>underline</u>
    <script>alert('hidden')</script><style>.hidden{display:none}</style>
    <img src=x onerror="evil()"><iframe src="https://example.com">hidden frame</iframe>
    <a href="https://example.com" onclick="evil()">Web</a>
    <a href="http://example.com">HTTP</a>
    <a href="mailto:alaubach@crosspointe.tv">Email Angie</a>
    <a href="javascript:alert(1)">Unsafe</a>
    <a href="java&#x73;cript:alert(1)">Encoded unsafe</a></p>`);

  assert.doesNotMatch(parsed.description_html,
      /<script|<style|<img|<iframe|onclick|onerror|style=|javascript:/i);
  assert.doesNotMatch(parsed.description, /alert\('hidden'\)|display:none/);
  for (const tag of ["b", "i", "em", "u"]) {
    assert.ok(parsed.description_html.includes(`<${tag}>`));
  }
  assert.ok(parsed.description_html.includes("href=\"https://example.com\""));
  assert.ok(parsed.description_html.includes("href=\"http://example.com\""));
  assert.ok(parsed.description_html.includes(
      "href=\"mailto:alaubach@crosspointe.tv\""));
});

test("malformed markers are hidden and report a warning", () => {
  for (const marker of [
    "{button_text:\"Register Your Booth\"}",
    `{button_link:"${signupUrl}"}`,
    `{button_text:""|button_link:"${signupUrl}"}`,
    "{button_text:\"Register\"|button_link:\"not a URL\"}",
  ]) {
    const parsed = parseEventDescription(
        `<p>Keep this copy.</p><p>${marker}</p>`);
    assert.ok(!parsed.registration_url, marker);
    assert.ok(!parsed.registration_button_text, marker);
    assert.ok(parsed.cta_warning, marker);
    assert.equal(parsed.description, "Keep this copy.");
    assert.doesNotMatch(parsed.description_html, /button_text|button_link/);
  }
});

test("CTA destinations must use HTTPS", () => {
  for (const url of [
    "http://example.com/signup",
    "javascript:alert(1)",
    "mailto:hello@example.com",
    "//example.com/signup",
    "/signup",
  ]) {
    const parsed = parseEventDescription(
        `{button_text:"Sign Up"|button_link:"${url}"}`);
    assert.ok(!parsed.registration_url, url);
    assert.ok(parsed.cta_warning, url);
    assert.equal(parsed.description, "");
  }
});

test("duplicate markers never silently select one destination", () => {
  const parsed = parseEventDescription(`<p>Choose how to help.</p>
    {button_text:"Host"|button_link:"${signupUrl}"}
    {button_text:"Volunteer"|button_link:"https://example.com/volunteer"}`);

  assert.ok(!parsed.registration_url);
  assert.ok(!parsed.registration_button_text);
  assert.ok(parsed.cta_warning);
  assert.equal(parsed.description, "Choose how to help.");
  assert.doesNotMatch(parsed.description_html,
      /button_text|button_link|example.com/);
});

test("empty input has no CTA or warnings", () => {
  for (const source of [null, undefined, "", "<p><br></p>"]) {
    const parsed = parseEventDescription(source);
    assert.equal(parsed.description, "");
    assert.ok(!parsed.registration_url);
    assert.ok(!parsed.registration_button_text);
    assert.ok(!parsed.cta_warning);
  }
});

test("an unclosed marker does not swallow subsequent paragraphs", () => {
  const parsed = parseEventDescription(`<p>Welcome neighbors.</p>
    <p>{button_text:"Register Your Booth"|button_link:"${signupUrl}"</p>
    <p>Candy donations go to the Children's Welcome Center.</p>`);

  assert.ok(!parsed.registration_url);
  assert.ok(!parsed.registration_button_text);
  assert.ok(parsed.cta_warning);
  assert.match(parsed.description, /Welcome neighbors\./);
  assert.match(parsed.description,
      /Candy donations go to the Children's Welcome Center\./);
  assert.match(parsed.description_html, /Candy donations/);
  assert.doesNotMatch(parsed.description, /button_text|button_link/);
  assert.doesNotMatch(parsed.description_html, /button_text|button_link/);
});
