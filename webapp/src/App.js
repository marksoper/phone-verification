import React, { Component } from 'react';
import Phone, { isValidPhoneNumber } from 'react-phone-number-input';
import rrui from 'react-phone-number-input/rrui.css';
import rpni from 'react-phone-number-input/style.css';
import api from './api';
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      phone: null,
      code: '',
      validPhoneNumberSubmitted: '',
      codeVerified: false
    };
    this.handlePhoneInputChange = this.handlePhoneInputChange.bind(this);
    this.handlePhoneSubmitButtonClick = this.handlePhoneSubmitButtonClick.bind(
      this
    );
    this.handleVerifyButtonClick = this.handleVerifyButtonClick.bind(this);
    this.handleCodeInputChange = this.handleCodeInputChange.bind(this);
  }

  handlePhoneInputChange(phone) {
    const isValidPhone = isValidPhoneNumber(phone);
    console.log(`${phone} is valid? ${JSON.stringify(isValidPhone)}`);
    this.setState({ phone });
  }

  handleCodeInputChange(ev) {
    const code = ev.target.value;
    console.log(`codeInputChange: ${code}`);
    this.setState({ code });
  }

  handlePhoneSubmitButtonClick(e) {
    e.preventDefault();
    const phone = this.state.phone;
    console.log(`submit button click: ${phone}`);
    api.requestVerificationCode(phone).then(res => {
      console.log(`requestVerificationCode response ok? ${res.ok}`);
      this.setState({ validPhoneNumberSubmitted: phone });
    });
  }

  handleVerifyButtonClick(e) {
    e.preventDefault();
    const code = this.state.code;
    const phoneNumber = this.state.validPhoneNumberSubmitted;
    console.log(
      `verify button click with code: ${code} and phone: ${phoneNumber}`
    );
    api.verifyVerificationCode(code, phoneNumber).then(res => {
      console.log(`verifyVerificationCode response ok? ${res.ok}`);
      this.setState({ codeVerified: true });
    });
  }

  generatePhoneEntryForm() {
    const country = 'US';
    const handlePhoneInputChange = this.handlePhoneInputChange;
    const handlePhoneSubmitButtonClick = this.handlePhoneSubmitButtonClick;
    const buttonDisabled = !isValidPhoneNumber(this.state.phone);
    if (this.state.validPhoneNumberSubmitted || this.state.codeVerified) {
      return null;
    }
    return (
      <div className="container phone-entry-form-container">
        <div className="verification-code-header">
          <h2>Phone number</h2>
        </div>
        <label htmlFor="phone-number-input">
          Enter your phone number. You will receive a text message with a
          verification code.
        </label>
        <div className="container phone-input-container">
          <Phone
            placeholder="Enter phone number"
            value={this.state.phone}
            onChange={handlePhoneInputChange}
            country={country}
            id="phone-number-input"
          />
        </div>
        <div className="container phone-submit-button-container">
          <button
            className="btn btn-primary"
            onClick={handlePhoneSubmitButtonClick}
            disabled={buttonDisabled}
          >
            Send verification code
          </button>
        </div>
      </div>
    );
  }

  generateCodeEntryForm() {
    const handleVerifyButtonClick = this.handleVerifyButtonClick;
    const submittedPhoneNumber = this.state.validPhoneNumberSubmitted;
    const codeVerified = this.state.codeVerified;
    const handleCodeInputChange = this.handleCodeInputChange;
    const label = (() => (
      <label htmlFor="verification-code-input">
        We sent a code to {submittedPhoneNumber}.
        <br />
        Enter that code to activate your account.
      </label>
    ))();
    if (!submittedPhoneNumber || codeVerified) {
      return null;
    }
    return (
      <div className="container verification-code-input-container">
        <div className="verification-code-header">
          <h2>Enter verification code</h2>
        </div>
        {label}
        <input
          type="text"
          value={this.state.code}
          onChange={handleCodeInputChange}
          id="verification-code-input"
          placeholder="Enter code"
        />
        <button className="btn btn-primary" onClick={handleVerifyButtonClick}>
          Verify
        </button>
      </div>
    );
  }

  generateCompletionView() {
    if (!this.state.codeVerified) {
      return null;
    }
    return (
      <div className="verification-completion-view-container">
        <div className="completion-view-header">
          <h2>Phone activated</h2>
        </div>
        <div className="completion-text">
          Your phone number {this.state.validatePhoneNumber} has been verified
          and activated.
        </div>
      </div>
    );
  }

  render() {
    const phoneEntryForm = this.generatePhoneEntryForm();
    const codeEntryForm = this.generateCodeEntryForm();
    const completionView = this.generateCompletionView();
    return (
      <div className="App container">
        {phoneEntryForm}
        {codeEntryForm}
        {completionView}
      </div>
    );
  }
}

export default App;
