import {
  RECAPTCHA_VERSION_2,
  reCaptcha2,
  addReCaptchaTokenInput
} from './recaptcha'
import b12Context from '../b12Context.json'

declare const __PRODUCT_URL__: string | undefined
declare const grecaptcha: {
  ready: (callback: () => void) => void
  execute: (siteKey: string, options: any) => Promise<string>
}

const PRODUCT_HOST = typeof __PRODUCT_URL__ === 'undefined' ? 'https://b12.io': __PRODUCT_URL__
const CONTACT_FORM_SUBMISSION_URL = `${PRODUCT_HOST}/contact/send/`

function setFormSubmissionMessage(messageNode: HTMLElement, formNode: HTMLFormElement, successMessage?: string) {
  if (successMessage) {
    messageNode.textContent = successMessage
  }
  messageNode.style.display = 'block'
  messageNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function setupForm(formEl: HTMLFormElement) {
  formEl.method = 'POST'
  formEl.action = CONTACT_FORM_SUBMISSION_URL

  const formUUID: string = formEl.dataset.formId || ''
  const formUUIDInput = document.createElement('input')
  formUUIDInput.type = 'hidden'
  formUUIDInput.name = 'form_id'
  formUUIDInput.value = formUUID

  // Handle honeypot field
  const honeypot = document.createElement('input')
  honeypot.type = 'text'
  honeypot.style.display = 'none'
  honeypot.name = 'sweet_auth_token'
  honeypot.setAttribute('aria-hidden', 'true')
  honeypot.setAttribute('aria-label', 'Auth token')

  // Form next step handling
  // TODO: uncomment when next steps are ready
  // const { form_data } = b12Context
  // if (form_data && Object.hasOwn(form_data, formUUID)) {
  //   const { next_page_url } = form_data[formUUID]
  const nextPage = document.createElement('input')
  nextPage.type = 'hidden'
  nextPage.style.display = 'none'
  nextPage.name = 'next_page'
  nextPage.value = window.location.href
  formEl.appendChild(nextPage)
  // }

  formEl.appendChild(formUUIDInput)
  formEl.appendChild(honeypot)

  // Handle posting form data via ajax request
  const formAJAXInput = document.createElement('input')
  formAJAXInput.type = 'hidden'
  formAJAXInput.name = 'ajax'
  formAJAXInput.value = 'true'
  formEl.appendChild(formAJAXInput)

  const url = formEl.getAttribute('action') || CONTACT_FORM_SUBMISSION_URL
  const formBtn = formEl.querySelector('button[type="submit"]') as HTMLButtonElement
  const reCaptchaVersion = parseInt(b12Context.recaptcha_version)

  // On form submit handler
  formEl.addEventListener('submit', function(e) {
    e.preventDefault()

    // Clean up recaptcha2 errors
    if (reCaptchaVersion === RECAPTCHA_VERSION_2) {
      reCaptcha2.clearError(formEl)

      if (!reCaptcha2.isValid(formEl)) {
        reCaptcha2.highlightError(formEl)
        return
      }
    }

    if (reCaptchaVersion === RECAPTCHA_VERSION_2) {
      addReCaptchaTokenInput(reCaptcha2.getResponseElementValue(formEl), formEl)
      submitForm()
    } else {
      if (typeof grecaptcha !== 'undefined') {
        grecaptcha.ready(() => {
          grecaptcha.execute('6Ld1R8kUAAAAAGEYGyd1RXFcdSGY03uF4y_yN40A', {})
            .then(token => {
              addReCaptchaTokenInput(token, formEl)
              submitForm()
            })
        })
      } else {
        console.info('grecaptcha undefined')
        submitForm()
      }
    }

    function submitForm() {
      const formData = new FormData(formEl)
      const formSuccessMessageElement = document.querySelector(`#b12-form-done-${formUUID}`) as HTMLElement
      const formErrorMessageElement = document.querySelector(`#b12-form-error-${formUUID}`) as HTMLElement
      formBtn.disabled = true

      // Convert FormData to URLSearchParams, consolidating multiple values with same name
      const consolidatedData: Record<string, string> = {}
      formData.forEach((value, key) => {
        if (consolidatedData[key]) {
          // If key already exists, append value with comma separator
          consolidatedData[key] = `${consolidatedData[key]},${value}`
        } else {
          consolidatedData[key] = value as string
        }
      })
      const urlEncodedData = new URLSearchParams(consolidatedData).toString()
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'X-API-VERSION': '2',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: urlEncodedData
      }

      fetch(url, fetchOptions)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Network response was not ok')
          }
          return response.json()
        })
        .then(function(response) {
          if (response && response.redirect) {
            window.location.href = response.redirect
            return
          }

          formErrorMessageElement.style.display = 'none'

          if (formSuccessMessageElement) {
            formEl.style.display = 'none'
            setFormSubmissionMessage(formSuccessMessageElement, formEl, response?.success_message)
          }
        })
        .catch(function() {
          formErrorMessageElement.style.display = 'block'
        })
        .finally(function() {
          formBtn.disabled = false
        })
    }
  })
}

function initializeForms() {
  // Set up forms
  document.querySelectorAll('form').forEach(form => {
    // Only set up forms with a data-form-id attribute and B12 action URL (if action is set)
    const formAction = form.getAttribute('action') || ''
    if (!form.dataset.formId || (formAction && formAction !== CONTACT_FORM_SUBMISSION_URL)) {
      return
    }
    setupForm(form as HTMLFormElement)
  })
}

document.addEventListener('DOMContentLoaded', initializeForms)
