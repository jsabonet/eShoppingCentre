export const RECAPTCHA_VERSION_2 = 2

function isValid(formEl: HTMLFormElement) {
  return getResponseElementValue(formEl).length !== 0
}

function getResponseElementValue(formEl: HTMLFormElement) {
  return (formEl.querySelector('.g-recaptcha-response') as HTMLInputElement).value || ''
}

function clearError(formEl: HTMLFormElement) {
  getErrorElement(formEl).style.display = 'none'
}

function highlightError(formEl: HTMLFormElement) {
  getErrorElement(formEl).style.display = 'block'
}

function getErrorElement(formEl: HTMLFormElement) {
  return formEl.querySelector('.grecaptcha-error') as HTMLElement
}

export const reCaptcha2 = {
  isValid,
  getResponseElementValue,
  clearError,
  highlightError
}

// Used for both v2 and v3
export function addReCaptchaTokenInput(token: string, formEl: HTMLFormElement) {
  const reCaptchaTokenInput = Object.assign(document.createElement('input'), {
    type: 'hidden',
    name: 'google_recaptcha_token',
    value: token
  })

  formEl.appendChild(reCaptchaTokenInput)
}
