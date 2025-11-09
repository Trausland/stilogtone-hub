import React, { useState, useRef, useEffect, type ReactElement } from 'react';
import Layout from '@theme/Layout';
import '@skatteetaten/ds-core-designtokens/index.css';
import { TextField, TextArea, Checkbox, Select, DatePicker, FileUploader, ErrorMessage, ErrorSummary } from '@skatteetaten/ds-forms';
import { TopBannerExternal, Footer } from '@skatteetaten/ds-layout';
import { StepList, Accordion, Tabs, Chips } from '@skatteetaten/ds-collections';
import { Button, Link } from '@skatteetaten/ds-buttons';
import { Icon } from '@skatteetaten/ds-icons';
import { Spinner } from '@skatteetaten/ds-progress';
import { Card, Panel } from '@skatteetaten/ds-content';
import { Breadcrumbs, Pagination } from '@skatteetaten/ds-navigation';
import { Modal } from '@skatteetaten/ds-overlays';
import { Alert, Tag } from '@skatteetaten/ds-status';
import { Table } from '@skatteetaten/ds-table';
import { Paragraph } from '@skatteetaten/ds-typography';

type GenResult = { jsx: ReactElement | null; code: string; topBanner: ReactElement | null };

// Props-definisjoner
type PropType = 'string' | 'boolean' | 'enum' | 'number' | 'reactnode';

type PropDefinition = {
  name: string;
  type: PropType;
  required?: boolean;
  defaultValue?: any;
  description?: string;
  enumValues?: string[]; // For enum-typer
  displayName?: string; // Norsk visningsnavn
};

type ComponentProps = Record<string, any>;

// Props-definisjoner per komponent
const componentPropsDefinitions: Record<string, PropDefinition[]> = {
  Modal: [
    { name: 'title', type: 'string', required: true, description: 'Overskrift', defaultValue: 'Modal title' },
    { name: 'variant', type: 'enum', description: 'Definerer stilen til Modal', enumValues: ['outline', 'plain'], defaultValue: 'outline' },
    { name: 'padding', type: 'enum', description: 'Padding rundt Modal', enumValues: ['none', 's', 'm', 'l', 'mega'], defaultValue: 'l' },
    { name: 'dismissOnEsc', type: 'boolean', description: 'Om modalen kan lukkes ved Esc-trykk', defaultValue: true },
    { name: 'dismissOnOutsideClick', type: 'boolean', description: 'Om autolukking skal skrus på/av', defaultValue: true },
    { name: 'hideCloseButton', type: 'boolean', description: 'Om lukkekryss skal skjules', defaultValue: false },
    { name: 'hideTitle', type: 'boolean', description: 'Skjuler overskriften, men fremdeles synlig for skjermleser', defaultValue: false },
  ],
  Button: [
    { name: 'children', type: 'string', required: true, description: 'Knappens tekst', defaultValue: 'Knapp' },
    { name: 'variant', type: 'enum', description: 'Definerer stilen til knappen', enumValues: ['primary', 'secondary', 'tertiary', 'danger'], defaultValue: 'primary' },
    { name: 'disabled', type: 'boolean', description: 'Om knappen skal være deaktivert', defaultValue: false },
  ],
  TextField: [
    { name: 'label', type: 'string', required: true, description: 'Feltets label', defaultValue: 'Fornavn', displayName: 'Ledetekst' },
    { name: 'description', type: 'string', description: 'Beskrivelse av feltet', defaultValue: '', displayName: 'Beskrivelse' },
    { name: 'showHelpText', type: 'boolean', description: 'Legg til hjelp-knapp', defaultValue: false, displayName: 'Hjelp-knapp' },
    { name: 'helpText', type: 'string', description: 'Hjelpetekst', defaultValue: '', displayName: 'Hjelpetekst' },
    { name: 'showErrorMessage', type: 'boolean', description: 'Vis feilmelding', defaultValue: false, displayName: 'Feilmelding' },
    { name: 'errorMessage', type: 'string', description: 'Feilmelding', defaultValue: '', displayName: 'Feilmelding' },
    { name: 'required', type: 'boolean', description: 'Om feltet er påkrevd', defaultValue: true, displayName: 'Påkrevd' },
    { name: 'disabled', type: 'boolean', description: 'Om feltet skal være deaktivert', defaultValue: false, displayName: 'Deaktivert' },
  ],
  Alert: [
    { name: 'showAlert', type: 'boolean', required: true, description: 'Om Alert skal vises', defaultValue: true },
    { name: 'variant', type: 'enum', description: 'Definerer stilen til Alert', enumValues: ['neutral', 'warning', 'error', 'danger', 'success'], defaultValue: 'warning' },
    { name: 'children', type: 'string', required: true, description: 'Alert-tekst', defaultValue: 'Avvist av kortutsteder. Ta kontakt med kortutsteder for mer informasjon.' },
  ],
  Card: [
    { name: 'title', type: 'string', description: 'Kortets tittel', defaultValue: '' },
    { name: 'children', type: 'string', required: true, description: 'Kortets innhold', defaultValue: 'Lorem ipsum dolor sit amet. Alle som har laget en nettside, trengt litt fylltekst eller bare surfet rundt på nettet har antageligvis sett disse ordene.' },
  ],
  Link: [
    { name: 'href', type: 'string', required: true, description: 'Lenkens URL', defaultValue: '#' },
    { name: 'children', type: 'string', required: true, description: 'Lenkens tekst', defaultValue: 'Lenke' },
    { name: 'variant', type: 'enum', description: 'Definerer stilen til lenken', enumValues: ['standard', 'secondary'], defaultValue: 'standard' },
  ],
};

// Mapping fra komponent til navn brukt i componentPropsDefinitions
const componentToPropName: Record<string, string> = {
  [Button]: 'Button',
  [Modal]: 'Modal',
  [TextField]: 'TextField',
  [Alert]: 'Alert',
  [Card]: 'Card',
  [Link]: 'Link',
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'o')
    .replaceAll('å', 'aa')
    .trim();
}

// Komponent-mapper: navn til komponent-funksjon
type ComponentInfo = {
  component: React.ElementType | string;
  needsWrapping?: boolean; // Trenger wrapping i article?
  isLayout?: boolean; // Er dette layout (TopBannerExternal, Footer)?
};

const componentMap: Record<string, ComponentInfo> = {
  // Layout
  topbanner: { component: TopBannerExternal, isLayout: true },
  topbannerexternal: { component: TopBannerExternal, isLayout: true },
  header: { component: TopBannerExternal, isLayout: true },
  footer: { component: Footer, isLayout: true },
  
  // HTML elementer
  h1: { component: 'h1', needsWrapping: true },
  heading1: { component: 'h1', needsWrapping: true },
  'heading 1': { component: 'h1', needsWrapping: true },
  
  // Forms
  textfield: { component: TextField, needsWrapping: true },
  textarea: { component: TextArea, needsWrapping: true },
  checkbox: { component: Checkbox, needsWrapping: true },
  select: { component: Select, needsWrapping: true },
  datepicker: { component: DatePicker, needsWrapping: true },
  fileuploader: { component: FileUploader, needsWrapping: true },
  fileupload: { component: FileUploader, needsWrapping: true },
  errormessage: { component: ErrorMessage, needsWrapping: true },
  errorsummary: { component: ErrorSummary, needsWrapping: true },
  
  // Collections
  steplist: { component: StepList, needsWrapping: true },
  step: { component: StepList, needsWrapping: true },
  accordion: { component: Accordion, needsWrapping: true },
  tabs: { component: Tabs, needsWrapping: true },
  tab: { component: Tabs, needsWrapping: true },
  chips: { component: Chips, needsWrapping: true },
  
  // Buttons
  button: { component: Button, needsWrapping: true },
  knapp: { component: Button, needsWrapping: true },
  link: { component: Link, needsWrapping: true },
  lenke: { component: Link, needsWrapping: true },
  
  // Icons
  icon: { component: Icon, needsWrapping: true },
  ikon: { component: Icon, needsWrapping: true },
  
  // Progress
  spinner: { component: Spinner, needsWrapping: true },
  
  // Content
  alert: { component: Alert, needsWrapping: true },
  card: { component: Card, needsWrapping: true },
  panel: { component: Panel, needsWrapping: true },
  tag: { component: Tag, needsWrapping: true },
  
  // Navigation
  breadcrumbs: { component: Breadcrumbs, needsWrapping: true },
  breadcrumb: { component: Breadcrumbs, needsWrapping: true },
  smuler: { component: Breadcrumbs, needsWrapping: true },
  pagination: { component: Pagination, needsWrapping: true },
  
  // Overlays
  modal: { component: Modal, needsWrapping: true },
  
  // Table
  table: { component: Table, needsWrapping: true },
  tabell: { component: Table, needsWrapping: true },
};

// Generer en komponent basert på navn og props
function createComponent(name: string, index: number, props?: ComponentProps): { jsx: ReactElement | null; code: string; needsWrapping: boolean; isLayout: boolean } {
  const normalized = normalize(name);
  const info = componentMap[normalized];
  
  if (!info) {
    return { jsx: null, code: `// Ukjent komponent: ${name}`, needsWrapping: false, isLayout: false };
  }
  
  const Component = info.component;
  const needsWrapping = info.needsWrapping || false;
  const isLayout = info.isLayout || false;
  
  // Spesialhåndtering for ulike komponenter
  if (Component === 'h1') {
    return {
      jsx: <h1 key={index}>Eksempelside</h1>,
      code: '    <h1>Eksempelside</h1>',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === TextField) {
    // Bruk props hvis de er satt, ellers bruk default-verdier
    const inputProps = props || {};
    const label = inputProps.label || 'Fornavn';
    const description = inputProps.description || '';
    const showHelpText = inputProps.showHelpText || false;
    const showErrorMessage = inputProps.showErrorMessage || false;
    const required = inputProps.required !== undefined ? inputProps.required : true;
    const disabled = inputProps.disabled || false;
    
    // Generer standard hjelpetekst basert på label hvis showHelpText er true og helpText ikke er satt
    let helpText = inputProps.helpText || '';
    if (showHelpText && !helpText) {
      helpText = `${label} er det første navnet ditt og kun det. Ikke inkluder mellomnavn.`;
    }
    
    // Generer standard feilmelding basert på label hvis showErrorMessage er true og errorMessage ikke er satt
    let errorMessage = inputProps.errorMessage || '';
    if (showErrorMessage && !errorMessage) {
      errorMessage = `${label} må fylles ut.`;
    }
    
    // Bygg props-objekt for TextField
    const textFieldProps: any = {
      label,
    };
    
    // Legg til valgfrie props hvis de er satt
    if (description) textFieldProps.description = description;
    if (showHelpText && helpText) textFieldProps.helpText = helpText;
    if (showErrorMessage && errorMessage) textFieldProps.errorMessage = errorMessage;
    if (required) textFieldProps.required = required;
    if (disabled) textFieldProps.disabled = disabled;
    
    // Generer kode med props - inkluder helpText og errorMessage hvis de er aktive
    const propsForCode = { ...inputProps };
    if (showHelpText && helpText) {
      propsForCode.helpText = helpText;
    }
    if (showErrorMessage && errorMessage) {
      propsForCode.errorMessage = errorMessage;
    }
    // Fjern showHelpText og showErrorMessage fra koden siden de ikke er props for TextField
    delete propsForCode.showHelpText;
    delete propsForCode.showErrorMessage;
    
    const propsString = Object.entries(propsForCode)
      .filter(([key, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (key === 'required' && value === false) return false;
        if (key === 'disabled' && value === false) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else if (typeof value === 'boolean') {
          return value ? `${key}={true}` : `${key}={false}`;
        }
        return `${key}={${JSON.stringify(value)}}`;
      })
      .join(' ');
    
    const textFieldPropsCode = propsString ? ` ${propsString}` : '';
    
    return {
      jsx: <TextField key={index} {...textFieldProps} />,
      code: `      <TextField${textFieldPropsCode} />`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === TextArea) {
    return {
      jsx: <TextArea key={index} label="Beskrivelse" />,
      code: '      <TextArea label="Beskrivelse" />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Checkbox) {
    return {
      jsx: <Checkbox key={index} label="Jeg godkjenner" />,
      code: '      <Checkbox label="Jeg godkjenner" />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Select) {
    return {
      jsx: <Select key={index} label="Velg" />,
      code: '      <Select label="Velg" />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === DatePicker) {
    return {
      jsx: <DatePicker key={index} label="Dato" />,
      code: '      <DatePicker label="Dato" />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === FileUploader) {
    return {
      jsx: <FileUploader key={index} label="Last opp fil" />,
      code: '      <FileUploader label="Last opp fil" />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === ErrorMessage) {
    return {
      jsx: <ErrorMessage key={index}>Dette feltet er påkrevd</ErrorMessage>,
      code: '      <ErrorMessage>Dette feltet er påkrevd</ErrorMessage>',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === ErrorSummary) {
    return {
      jsx: <ErrorSummary key={index} title="Det er feil i skjemaet" />,
      code: '      <ErrorSummary title="Det er feil i skjemaet" />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === StepList) {
    return {
      jsx: (
        <StepList key={index}>
          <StepList.Step stepNumber={1} title="Overskrift" variant="active">
            Innhold
          </StepList.Step>
          <StepList.Step stepNumber={2} title="Overskrift">
            Innhold
          </StepList.Step>
        </StepList>
      ),
      code: `      <StepList>
        <StepList.Step
          stepNumber={1}
          title="Overskrift"
          variant="active"
        >
          Innhold
        </StepList.Step>
        <StepList.Step
          stepNumber={2}
          title="Overskrift"
        >
          Innhold
        </StepList.Step>
      </StepList>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === TopBannerExternal) {
    return {
      jsx: <TopBannerExternal key={index} />,
      code: '  <TopBannerExternal />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Footer) {
    return {
      jsx: <Footer key={index} />,
      code: '  <Footer />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Button) {
    // Bruk props hvis de er satt, ellers bruk default-verdier
    const inputProps = props || {};
    const children = inputProps.children || 'Knapp';
    const variant = inputProps.variant || 'primary';
    const disabled = inputProps.disabled || false;
    
    // Bygg props-objekt for Button
    const buttonProps: any = {
      variant,
    };
    
    // Legg til disabled hvis den er satt
    if (disabled) buttonProps.disabled = disabled;
    
    // Generer kode med props
    const propsString = Object.entries(inputProps)
      .filter(([key, value]) => {
        if (value === undefined || value === null || value === '') return false;
        // Filtrer ut default-verdier
        if (key === 'variant' && value === 'primary') return false;
        if (key === 'disabled' && value === false) return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else if (typeof value === 'boolean') {
          return value ? `${key}={true}` : `${key}={false}`;
        }
        return `${key}={${JSON.stringify(value)}}`;
      })
      .join(' ');
    
    const buttonPropsCode = propsString ? ` ${propsString}` : '';
    
    return {
      jsx: <Button key={index} {...buttonProps}>{children}</Button>,
      code: `      <Button${buttonPropsCode}>${children}</Button>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Accordion) {
    return {
      jsx: (
        <Accordion key={index}>
          <Accordion.Item title="Overskrift 1">
            Innhold i første element
          </Accordion.Item>
          <Accordion.Item title="Overskrift 2">
            Innhold i andre element
          </Accordion.Item>
        </Accordion>
      ),
      code: `      <Accordion>
        <Accordion.Item title="Overskrift 1">
          Innhold i første element
        </Accordion.Item>
        <Accordion.Item title="Overskrift 2">
          Innhold i andre element
        </Accordion.Item>
      </Accordion>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Tabs) {
    return {
      jsx: (
        <Tabs key={index}>
          <Tabs.Tab title="Fane 1">Innhold i første fane</Tabs.Tab>
          <Tabs.Tab title="Fane 2">Innhold i andre fane</Tabs.Tab>
        </Tabs>
      ),
      code: `      <Tabs>
        <Tabs.Tab title="Fane 1">Innhold i første fane</Tabs.Tab>
        <Tabs.Tab title="Fane 2">Innhold i andre fane</Tabs.Tab>
      </Tabs>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Card) {
    // Bruk props hvis de er satt, ellers bruk default-verdier
    const inputProps = props || {};
    const title = inputProps.title || '';
    const children = inputProps.children || 'Lorem ipsum dolor sit amet. Alle som har laget en nettside, trengt litt fylltekst eller bare surfet rundt på nettet har antageligvis sett disse ordene.';
    
    // Bygg props-objekt for Card
    const cardProps: any = {};
    if (title) cardProps.title = title;
    
    // Generer kode med props
    const propsString = Object.entries(inputProps)
      .filter(([key, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (key === 'children') return false; // children håndteres separat
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        }
        return `${key}={${JSON.stringify(value)}}`;
      })
      .join(' ');
    
    const cardPropsCode = propsString ? ` ${propsString}` : '';
    
    return {
      jsx: (
        <Card key={index} {...cardProps}>
          <Card.Content>
            {children}
          </Card.Content>
        </Card>
      ),
      code: `      <Card${cardPropsCode}>
        <Card.Content>
          ${children}
        </Card.Content>
      </Card>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Panel) {
    return {
      jsx: (
        <Panel key={index} title="Tittel">
          <Panel.Content>
            Innhold i panelet
          </Panel.Content>
        </Panel>
      ),
      code: `      <Panel title="Tittel">
        <Panel.Content>
          Innhold i panelet
        </Panel.Content>
      </Panel>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Alert) {
    // Bruk props hvis de er satt, ellers bruk default-verdier
    const inputProps = props || {};
    const showAlert = inputProps.showAlert !== undefined ? inputProps.showAlert : true;
    const variant = inputProps.variant || 'warning';
    const children = inputProps.children || 'Avvist av kortutsteder. Ta kontakt med kortutsteder for mer informasjon.';
    
    // Bygg props-objekt for Alert
    const alertProps: any = {
      showAlert,
      variant,
    };
    
    // Generer kode med props
    const propsString = Object.entries(inputProps)
      .filter(([key, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (key === 'showAlert' && value === true) return false;
        if (key === 'variant' && value === 'warning') return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else if (typeof value === 'boolean') {
          return value ? `${key}={true}` : `${key}={false}`;
        }
        return `${key}={${JSON.stringify(value)}}`;
      })
      .join(' ');
    
    // Generer kode med props - vis showAlert og variant
    const codeProps: string[] = [];
    if (showAlert) codeProps.push('showAlert');
    if (variant !== 'warning') codeProps.push(`variant="${variant}"`);
    
    const alertPropsCode = codeProps.length > 0 ? ` ${codeProps.join(' ')}` : '';
    
    return {
      jsx: (
        <Alert key={index} {...alertProps}>
          {children}
        </Alert>
      ),
      code: `      <Alert${alertPropsCode}>
        ${children}
      </Alert>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Tag) {
    return {
      jsx: <Tag key={index}>Label</Tag>,
      code: '      <Tag>Label</Tag>',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Chips) {
    return {
      jsx: <Chips key={index}>Label</Chips>,
      code: '      <Chips>Label</Chips>',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Link) {
    // Bruk props hvis de er satt, ellers bruk default-verdier
    const inputProps = props || {};
    const href = inputProps.href || '#';
    const children = inputProps.children || 'Lenke';
    const variant = inputProps.variant || 'standard';
    
    // Bygg props-objekt for Link
    const linkProps: any = {
      href,
    };
    
    // Legg til variant hvis den ikke er standard
    if (variant !== 'standard') linkProps.variant = variant;
    
    // Generer kode med props
    const propsString = Object.entries(inputProps)
      .filter(([key, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (key === 'children') return false; // children håndteres separat
        if (key === 'variant' && value === 'standard') return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        }
        return `${key}={${JSON.stringify(value)}}`;
      })
      .join(' ');
    
    const linkPropsCode = propsString ? ` ${propsString}` : '';
    
    return {
      jsx: <Link key={index} {...linkProps}>{children}</Link>,
      code: `      <Link${linkPropsCode}>${children}</Link>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Breadcrumbs) {
    return {
      jsx: (
        <Breadcrumbs key={index}>
          <Breadcrumbs.Item text="Forside" href="#" />
          <Breadcrumbs.Item text="Side" href="#" />
          <Breadcrumbs.Item text="Nåværende side" />
        </Breadcrumbs>
      ),
      code: `      <Breadcrumbs>
        <Breadcrumbs.Item text="Forside" href="#" />
        <Breadcrumbs.Item text="Side" href="#" />
        <Breadcrumbs.Item text="Nåværende side" />
      </Breadcrumbs>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Pagination) {
    return {
      jsx: <Pagination key={index} currentPage={1} totalPages={5} />,
      code: '      <Pagination currentPage={1} totalPages={5} />',
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Table) {
    return {
      jsx: (
        <Table key={index} caption="Tabell">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Kolonnetittel</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.DataCell>Data</Table.DataCell>
            </Table.Row>
          </Table.Body>
        </Table>
      ),
      code: `      <Table caption="Tabell">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Kolonnetittel</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.DataCell>Data</Table.DataCell>
          </Table.Row>
        </Table.Body>
      </Table>`,
      needsWrapping,
      isLayout,
    };
  }
  
  if (Component === Modal) {
    // Bruk props hvis de er satt, ellers bruk default-verdier
    const inputProps = props || {};
    const title = inputProps.title || 'Modal title';
    const variant = inputProps.variant || 'outline';
    const padding = inputProps.padding || 'l';
    const dismissOnEsc = inputProps.dismissOnEsc !== undefined ? inputProps.dismissOnEsc : true;
    const dismissOnOutsideClick = inputProps.dismissOnOutsideClick !== undefined ? inputProps.dismissOnOutsideClick : true;
    const hideCloseButton = inputProps.hideCloseButton || false;
    const hideTitle = inputProps.hideTitle || false;
    
    // Wrapper component for Modal med ref - unik for hver instans
    const ModalWrapper = React.memo(() => {
      const modalRef = React.useRef<any>(null);
      const handleOpen = React.useCallback(() => {
        if (modalRef.current && typeof modalRef.current.show === 'function') {
          modalRef.current.show();
        } else if (modalRef.current && typeof modalRef.current.open === 'function') {
          modalRef.current.open();
        } else {
          console.log('Modal ref:', modalRef.current);
        }
      }, []);
      
      // Bygg props-objekt for Modal
      const modalPropsToPass: any = {
        ref: modalRef,
        title,
        variant,
        padding,
        dismissOnEsc,
        dismissOnOutsideClick,
      };
      
      // Legg til valgfrie props hvis de er satt
      if (hideCloseButton) modalPropsToPass.hideCloseButton = hideCloseButton;
      if (hideTitle) modalPropsToPass.hideTitle = hideTitle;
      
      return (
        <div key={`modal-wrapper-${index}`} style={{ position: 'relative', display: 'inline-block' }}>
          <Button onClick={handleOpen}>Åpne modal</Button>
          <Modal {...modalPropsToPass}>
            <Paragraph>
              Lorem ipsum dolor sit amet. Alle som har laget en nettside, trengt litt fylltekst eller bare surfet rundt på nettet har antageligvis sett disse ordene, etterfulgt av en tilsynelatende eviglang tekst fylt med latinske liksomsetninger.
            </Paragraph>
          </Modal>
        </div>
      );
    });
    ModalWrapper.displayName = `ModalWrapper-${index}`;
    
    // Generer kode med props - bruk inputProps for kodegenerering
    const propsString = Object.entries(inputProps)
      .filter(([key, value]) => {
        // Filtrer ut default-verdier og tomme verdier
        if (value === undefined || value === null || value === '') return false;
        // Hvis boolean, vis kun hvis den ikke er default
        if (key === 'dismissOnEsc' && value === true) return false;
        if (key === 'dismissOnOutsideClick' && value === true) return false;
        if (key === 'hideCloseButton' && value === false) return false;
        if (key === 'hideTitle' && value === false) return false;
        if (key === 'variant' && value === 'outline') return false;
        if (key === 'padding' && value === 'l') return false;
        return true;
      })
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else if (typeof value === 'boolean') {
          return value ? `${key}={true}` : `${key}={false}`;
        }
        return `${key}={${JSON.stringify(value)}}`;
      })
      .join(' ');
    
    const modalPropsCode = propsString ? ` ${propsString}` : '';
    
    return {
      jsx: <ModalWrapper key={`modal-${index}`} />,
      code: `      const modalRef = useRef(null);
      
      const handleOpen = () => {
        modalRef.current?.show();
      };
      
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Button onClick={handleOpen}>Åpne modal</Button>
        <Modal ref={modalRef}${modalPropsCode}>
          <Paragraph>
            Lorem ipsum dolor sit amet. Alle som har laget en nettside, trengt litt fylltekst eller bare surfet rundt på nettet har antageligvis sett disse ordene, etterfulgt av en tilsynelatende eviglang tekst fylt med latinske liksomsetninger.
          </Paragraph>
        </Modal>
      </div>`,
      needsWrapping,
      isLayout,
    };
  }
  
  // Fallback for andre komponenter
  try {
    const jsx = React.createElement(Component as React.ElementType, { key: index });
    const componentName = typeof Component === 'string' ? Component : (Component as any).name || name;
    return {
      jsx,
      code: `      <${componentName} />`,
      needsWrapping,
      isLayout,
    };
  } catch {
    return {
      jsx: null,
      code: `// Kunne ikke generere komponent: ${name}`,
      needsWrapping,
      isLayout,
    };
  }
}

// Props Panel komponent
function PropsPanel({ 
  componentName, 
  props, 
  onPropsChange,
  instanceNumber,
  totalInstances,
  lineNumber
}: { 
  componentName: string; 
  props: ComponentProps; 
  onPropsChange: (props: ComponentProps) => void;
  instanceNumber?: number;
  totalInstances?: number;
  lineNumber?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const definitions = componentPropsDefinitions[componentName] || [];
  
  if (definitions.length === 0) return null;
  
  const updateProp = (propName: string, value: any) => {
    const newProps = { ...props, [propName]: value };
    
    // Hvis showHelpText settes til true, sett standard hjelpetekst hvis helpText ikke er satt
    if (componentName === 'TextField' && propName === 'showHelpText' && value === true) {
      const label = props.label || 'Fornavn';
      if (!props.helpText || props.helpText === '') {
        newProps.helpText = `${label} er det første navnet ditt og kun det. Ikke inkluder mellomnavn.`;
      }
    }
    
    // Hvis label endres og showHelpText er true, oppdater helpText hvis den er standardteksten
    if (componentName === 'TextField' && propName === 'label' && props.showHelpText) {
      const oldLabel = props.label || 'Fornavn';
      const oldHelpText = props.helpText || '';
      if (oldHelpText === `${oldLabel} er det første navnet ditt og kun det. Ikke inkluder mellomnavn.` || oldHelpText === '') {
        newProps.helpText = `${value} er det første navnet ditt og kun det. Ikke inkluder mellomnavn.`;
      }
    }
    
    // Hvis showErrorMessage settes til true, sett standard feilmelding hvis errorMessage ikke er satt
    if (componentName === 'TextField' && propName === 'showErrorMessage' && value === true) {
      const label = props.label || 'Fornavn';
      if (!props.errorMessage || props.errorMessage === '') {
        newProps.errorMessage = `${label} må fylles ut.`;
      }
    }
    
    // Hvis label endres og showErrorMessage er true, oppdater errorMessage hvis den er standardteksten
    if (componentName === 'TextField' && propName === 'label' && props.showErrorMessage) {
      const oldLabel = props.label || 'Fornavn';
      const oldErrorMessage = props.errorMessage || '';
      if (oldErrorMessage === `${oldLabel} må fylles ut.` || oldErrorMessage === '') {
        newProps.errorMessage = `${value} må fylles ut.`;
      }
    }
    
    onPropsChange(newProps);
  };
  
  // Bygg tittel med nummerering hvis det er flere instanser
  let title = `${componentName}`;
  if (totalInstances && totalInstances > 1) {
    title += ` #${instanceNumber}`;
  } else if (totalInstances === 1) {
    title += ` #1`;
  }
  
  return (
    <div style={{ 
      marginBottom: 16, 
      border: '1px solid #e0e0e0', 
      borderRadius: 6, 
      overflow: 'hidden',
      backgroundColor: '#fafafa'
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          background: '#f8f9fa',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left'
        }}
      >
        <span>{title}</span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </button>
      
      {isOpen && (
        <div style={{ padding: 16, backgroundColor: '#ffffff' }}>
          {definitions.map((prop) => {
            // Skjul helpText-feltet hvis showHelpText er false
            if (componentName === 'TextField' && prop.name === 'helpText') {
              const showHelpText = props.showHelpText !== undefined ? props.showHelpText : false;
              if (!showHelpText) {
                return null;
              }
            }
            
            // Skjul errorMessage-feltet hvis showErrorMessage er false
            if (componentName === 'TextField' && prop.name === 'errorMessage') {
              const showErrorMessage = props.showErrorMessage !== undefined ? props.showErrorMessage : false;
              if (!showErrorMessage) {
                return null;
              }
            }
            
            const currentValue = props[prop.name] !== undefined ? props[prop.name] : prop.defaultValue;
            
            return (
              <div key={prop.name} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                  {prop.displayName || prop.name}
                  {prop.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                  {prop.displayName && <span style={{ color: '#64748b', marginLeft: 4, fontWeight: 400, fontSize: 11 }}>({prop.name})</span>}
                </label>
                
                {prop.type === 'string' && (
                  <>
                    {prop.name === 'errorMessage' || prop.name === 'description' || prop.name === 'helpText' ? (
                      <textarea
                        value={currentValue || ''}
                        onChange={(e) => updateProp(prop.name, e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ccc',
                          borderRadius: 4,
                          fontSize: 13,
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentValue || ''}
                        onChange={(e) => updateProp(prop.name, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ccc',
                          borderRadius: 4,
                          fontSize: 13
                        }}
                      />
                    )}
                  </>
                )}
                
                {prop.type === 'boolean' && (
                  <div
                    onClick={() => updateProp(prop.name, !currentValue)}
                    style={{
                      position: 'relative',
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: currentValue ? '#3b82f6' : '#cbd5e1',
                      transition: 'background-color 0.2s',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: currentValue ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  </div>
                )}
                
                {prop.type === 'enum' && prop.enumValues && (
                  <select
                    value={currentValue || prop.defaultValue}
                    onChange={(e) => updateProp(prop.name, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #ccc',
                      borderRadius: 4,
                      fontSize: 13
                    }}
                  >
                    {prop.enumValues.map((val) => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Parser for komponentnavn i rekkefølge */
function generateFromPrompt(raw: string, componentPropsMap?: Record<number, ComponentProps>): GenResult {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { jsx: null, code: '// Skriv inn komponentnavn (en per linje)' };
  }
  
  const components: Array<{ jsx: ReactElement | null; code: string; needsWrapping: boolean; isLayout: boolean }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const props = componentPropsMap?.[i];
    const component = createComponent(lines[i], i, props);
    components.push(component);
  }
  
  // Separer layout-komponenter fra hovedinnhold
  const layoutComponents: Array<{ jsx: ReactElement | null; code: string }> = [];
  const mainComponents: Array<{ jsx: ReactElement | null; code: string }> = [];
  
  for (const comp of components) {
    if (comp.isLayout) {
      layoutComponents.push({ jsx: comp.jsx, code: comp.code });
    } else if (comp.needsWrapping) {
      mainComponents.push({ jsx: comp.jsx, code: comp.code });
    } else {
      mainComponents.push({ jsx: comp.jsx, code: comp.code });
    }
  }
  
  // Bygg JSX
  const jsxParts: ReactElement[] = [];
  const codeParts: string[] = [];
  
  // TopBannerExternal først (hvis den finnes) - separer ut
  const topBanner = layoutComponents.find(c => c.code.includes('TopBannerExternal'));
  const topBannerJsx = topBanner && topBanner.jsx ? topBanner.jsx : null;
  
  // Legg TopBannerExternal til i kode (men ikke i jsx for preview)
  if (topBanner && topBanner.code) {
    codeParts.push(topBanner.code);
  }
  
  // Main hvis vi har hovedinnhold
  if (mainComponents.length > 0) {
    const mainJsx = (
      <main key="main" id="content" tabIndex={-1}>
        {mainComponents.map(c => c.jsx).filter(Boolean)}
      </main>
    );
    jsxParts.push(mainJsx);
    
    codeParts.push('  <main id="content" tabIndex={-1}>');
    mainComponents.forEach(c => {
      if (c.code && !c.code.startsWith('//')) {
        codeParts.push(c.code);
      }
    });
    codeParts.push('  </main>');
  }
  
  // Footer til slutt (hvis den finnes)
  const footer = layoutComponents.find(c => c.code.includes('Footer'));
  if (footer && footer.jsx) {
    jsxParts.push(footer.jsx);
    codeParts.push(footer.code);
  }
  
  const code = `<>\n${codeParts.join('\n')}\n</>`;
  const jsx = <>{jsxParts}</>;
  
  return { jsx, code, topBanner: topBannerJsx };
}

export default function Generator(): React.JSX.Element {
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [component, setComponent] = useState<ReactElement | null>(null);
  const [topBanner, setTopBanner] = useState<ReactElement | null>(null);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState(false);
  // State for props per komponent (indexed by component index)
  const [componentPropsMap, setComponentPropsMap] = useState<Record<number, ComponentProps>>({});
  // State for komponentnavn per index (for å vite hvilke props som skal vises)
  const [componentNames, setComponentNames] = useState<Record<number, string>>({});
  // State for visningsbredde (standard eller mobil)
  const [viewWidth, setViewWidth] = useState<'standard' | 'mobile'>('standard');
  // State for å utvide/minimere props-panelet
  const [isPropsPanelExpanded, setIsPropsPanelExpanded] = useState(false);
  // Ref for preview-containeren
  const previewRef = useRef<HTMLDivElement>(null);
  // Ref for egenskaper-knappen
  const propsButtonRef = useRef<HTMLButtonElement>(null);
  // State for props panelet sin posisjon
  const [propsPanelLeft, setPropsPanelLeft] = useState<number>(0);
  const [propsPanelTop, setPropsPanelTop] = useState<number>(150);

  // Beregn posisjonen for props panelet basert på egenskaper-knappens posisjon
  useEffect(() => {
    const updatePosition = () => {
      if (propsButtonRef.current) {
        const rect = propsButtonRef.current.getBoundingClientRect();
        // Plasser panelet slik at høyre side er kant i kant med knappens høyre side
        setPropsPanelLeft(rect.right - 400); // 400px er bredden på panelet
        setPropsPanelTop(rect.bottom + 8); // Plasser panelet rett under knappen med litt spacing
      } else if (previewRef.current) {
        // Fallback til preview-containeren hvis knappen ikke er funnet
        const rect = previewRef.current.getBoundingClientRect();
        setPropsPanelLeft(rect.left);
        setPropsPanelTop(rect.top);
      } else {
        // Fallback-verdier hvis ingen ref er satt ennå
        setPropsPanelLeft(0);
        setPropsPanelTop(150);
      }
    };

    // Kjør etter en liten delay for å sikre at DOM er klar
    const timeoutId = setTimeout(updatePosition, 100);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [code, viewWidth, isPropsPanelExpanded]);

  const handleGenerate = () => {
    const lines = prompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const names: Record<number, string> = {};
    
    // Hent komponentnavn for hver linje
    for (let i = 0; i < lines.length; i++) {
      const normalized = normalize(lines[i]);
      const info = componentMap[normalized];
      if (info && info.component) {
        // Hent komponentnavn - bruk eksplisitt mapping hvis tilgjengelig
        let componentName: string;
        if (typeof info.component === 'string') {
          componentName = info.component;
        } else if (componentToPropName[info.component as any]) {
          // Bruk eksplisitt mapping for props-støttede komponenter
          componentName = componentToPropName[info.component as any];
        } else {
          // Fallback til komponentnavn eller original tekst
          componentName = (info.component as any).name || (info.component as any).displayName || lines[i];
        }
        names[i] = componentName;
      }
    }
    
    setComponentNames(names);
    
    // Initialiser props med default-verdier hvis ikke allerede satt
    const newPropsMap: Record<number, ComponentProps> = { ...componentPropsMap };
    for (let i = 0; i < lines.length; i++) {
      const componentName = names[i];
      if (componentName && componentPropsDefinitions[componentName] && !newPropsMap[i]) {
        // Initialiser med default-verdier
        const defaults: ComponentProps = {};
        componentPropsDefinitions[componentName].forEach(prop => {
          if (prop.defaultValue !== undefined) {
            defaults[prop.name] = prop.defaultValue;
          }
        });
        newPropsMap[i] = defaults;
      }
    }
    setComponentPropsMap(newPropsMap);
    
    const { jsx, code, topBanner: topBannerJsx } = generateFromPrompt(prompt, newPropsMap);
    setComponent(jsx);
    setTopBanner(topBannerJsx);
    setCode(code);
    setCopiedCodeBlock(false);
  };
  
  const handlePropsChange = (index: number, props: ComponentProps) => {
    const newPropsMap = { ...componentPropsMap, [index]: props };
    setComponentPropsMap(newPropsMap);
    
    // Regenerer med nye props
    const { jsx, code } = generateFromPrompt(prompt, newPropsMap);
    setComponent(jsx);
    setCode(code);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeBlock(true);
    } catch {
      alert('Klarte ikke å kopiere – kopier manuelt (Ctrl/Cmd+C).');
    }
  };

  return (
    <Layout
      title="Komponent-generator"
      description="Generer komponenter fra tekstbeskrivelse">
      <div className="site" style={{ padding: '2rem 1rem' }}>
        <h1>Komponent-generator</h1>
        <p>Skriv inn hva du vil ha fra designsystemet, og få generert kode og forhåndsvisning.</p>

        {/* Generator-panel – følger samme bredde som hele siden */}
        <div style={{ border: '1px solid #ddd', background: '#fafafa', borderRadius: 6, padding: 16, marginBottom: 24, marginTop: 24 }}>
          <label htmlFor="prompt" style={{ display: 'block', fontWeight: 600 }}>
            Hva vil du lage?
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            style={{ width: '100%', marginTop: 8, padding: 8, fontFamily: 'inherit', border: '1px solid #ccc', borderRadius: '4px' }}
            placeholder="Skriv her"
          />
          <div style={{ marginTop: 16 }}>
            <Button onClick={handleGenerate}>Generer</Button>
          </div>
        </div>

        {/* Resultat – også i .site */}
        {code && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>Generert kode</div>
              <Button onClick={copyCode} variant="secondary">
                {copiedCodeBlock ? 'Kopiert!' : 'Kopier kode'}
              </Button>
            </div>

            <pre
              style={{
                background: '#f4f4f4',
                padding: 12,
                overflow: 'auto',
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                marginBottom: 24,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
            >
              {code}
            </pre>

            {/* Forhåndsvisning og Props Panel wrapper */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>Forhåndsvisning</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="viewWidth"
                      value="standard"
                      checked={viewWidth === 'standard'}
                      onChange={(e) => setViewWidth(e.target.value as 'standard' | 'mobile')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Standard</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="viewWidth"
                      value="mobile"
                      checked={viewWidth === 'mobile'}
                      onChange={(e) => setViewWidth(e.target.value as 'standard' | 'mobile')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Mobil (320px)</span>
                  </label>
                  <button
                    ref={propsButtonRef}
                    onClick={() => setIsPropsPanelExpanded(!isPropsPanelExpanded)}
                    title={isPropsPanelExpanded ? 'Minimer egenskaper' : 'Vis egenskaper'}
                    style={{
                      background: 'none',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#0f172a',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.2s, border-color 0.2s',
                      backgroundColor: isPropsPanelExpanded ? '#f0f4f8' : '#ffffff',
                    }}
                  >
                    Egenskaper
                    {isPropsPanelExpanded ? ' ▲' : ' ▼'}
                  </button>
                </div>
              </div>
              <div>
                <div 
                  className="generator-preview"
                  style={viewWidth === 'mobile' ? { 
                    margin: '0 auto',
                    width: 'fit-content'
                  } : {}}
                >
                  {topBanner && topBanner}
                  <div 
                    className={viewWidth === 'mobile' ? 'generator-preview-mobile-wrapper' : ''}
                    style={viewWidth === 'mobile' ? { 
                      maxWidth: '320px',
                      width: '320px',
                      boxSizing: 'border-box',
                      padding: '16px'
                    } : {
                      padding: '16px'
                    }}
                  >
                    {component}
                  </div>
                </div>
              </div>
            </div>

            {/* Props Panel - overlay som flyter over forhåndsvisningen, bruker fixed positioning for å ikke påvirke skip link-en */}
            {code && isPropsPanelExpanded && (
              <div style={{
                position: 'fixed',
                left: `${propsPanelLeft || 0}px`,
                top: `${propsPanelTop || 150}px`,
                bottom: '100px',
                height: 'auto',
                maxHeight: 'calc(100vh - 250px)',
                minHeight: '400px',
                width: '400px',
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'width 0.3s ease, left 0.3s ease, bottom 0.3s ease',
                zIndex: 1000
              }}>
                {/* Header med tittel - knappen er flyttet til header-raden */}
                <div style={{
                  padding: '16px',
                  borderBottom: '1px solid #e0e0e0',
                  backgroundColor: '#f8f9fa',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Egenskaper</div>
                </div>
                
                {/* Scrollbart innhold */}
                <div style={{
                  overflowY: 'auto',
                  flex: 1,
                  padding: '16px'
                }}>
                    {(() => {
                      // Tell hvor mange instanser av hver komponenttype
                      const componentCounts: Record<string, number> = {};
                      const componentInstances: Record<string, number> = {};
                      
                      Object.entries(componentNames).forEach(([index, componentName]) => {
                        if (componentPropsDefinitions[componentName]) {
                          componentCounts[componentName] = (componentCounts[componentName] || 0) + 1;
                        }
                      });
                      
                      return Object.entries(componentNames).map(([index, componentName]) => {
                        if (componentPropsDefinitions[componentName]) {
                          // Tell hvilken instans dette er
                          componentInstances[componentName] = (componentInstances[componentName] || 0) + 1;
                          const instanceNumber = componentInstances[componentName];
                          const totalInstances = componentCounts[componentName];
                          
                          return (
                            <PropsPanel
                              key={index}
                              componentName={componentName}
                              props={componentPropsMap[parseInt(index)] || {}}
                              onPropsChange={(props) => handlePropsChange(parseInt(index), props)}
                              instanceNumber={instanceNumber}
                              totalInstances={totalInstances}
                              lineNumber={parseInt(index)}
                            />
                          );
                        }
                        return null;
                      });
                    })()}
                  </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

