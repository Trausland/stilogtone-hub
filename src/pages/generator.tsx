import React, { useState, type ReactElement } from 'react';
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

type GenResult = { jsx: ReactElement | null; code: string };

// Props-definisjoner
type PropType = 'string' | 'boolean' | 'enum' | 'number' | 'reactnode';

type PropDefinition = {
  name: string;
  type: PropType;
  required?: boolean;
  defaultValue?: any;
  description?: string;
  enumValues?: string[]; // For enum-typer
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
    { name: 'label', type: 'string', required: true, description: 'Feltets label', defaultValue: 'Fornavn' },
    { name: 'description', type: 'string', description: 'Beskrivelse av feltet', defaultValue: '' },
    { name: 'errorMessage', type: 'string', description: 'Feilmelding', defaultValue: '' },
    { name: 'required', type: 'boolean', description: 'Om feltet er påkrevd', defaultValue: false },
    { name: 'disabled', type: 'boolean', description: 'Om feltet skal være deaktivert', defaultValue: false },
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
    const errorMessage = inputProps.errorMessage || '';
    const required = inputProps.required || false;
    const disabled = inputProps.disabled || false;
    
    // Bygg props-objekt for TextField
    const textFieldProps: any = {
      label,
    };
    
    // Legg til valgfrie props hvis de er satt
    if (description) textFieldProps.description = description;
    if (errorMessage) textFieldProps.errorMessage = errorMessage;
    if (required) textFieldProps.required = required;
    if (disabled) textFieldProps.disabled = disabled;
    
    // Generer kode med props
    const propsString = Object.entries(inputProps)
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
    onPropsChange({ ...props, [propName]: value });
  };
  
  // Bygg tittel med nummerering hvis det er flere instanser
  let title = `Props for ${componentName}`;
  if (totalInstances && totalInstances > 1) {
    title += ` #${instanceNumber}`;
  }
  if (lineNumber !== undefined) {
    title += ` (linje ${lineNumber + 1})`;
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
            const currentValue = props[prop.name] !== undefined ? props[prop.name] : prop.defaultValue;
            
            return (
              <div key={prop.name} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                  {prop.name}
                  {prop.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                </label>
                {prop.description && (
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                    {prop.description}
                  </div>
                )}
                
                {prop.type === 'string' && (
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
                
                {prop.type === 'boolean' && (
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={currentValue || false}
                      onChange={(e) => updateProp(prop.name, e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: 13 }}>{currentValue ? 'På' : 'Av'}</span>
                  </label>
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
  
  // TopBannerExternal først (hvis den finnes)
  const topBanner = layoutComponents.find(c => c.code.includes('TopBannerExternal'));
  if (topBanner && topBanner.jsx) {
    jsxParts.push(topBanner.jsx);
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
  
  return { jsx, code };
}

export default function Generator(): React.JSX.Element {
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [component, setComponent] = useState<ReactElement | null>(null);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState(false);
  // State for props per komponent (indexed by component index)
  const [componentPropsMap, setComponentPropsMap] = useState<Record<number, ComponentProps>>({});
  // State for komponentnavn per index (for å vite hvilke props som skal vises)
  const [componentNames, setComponentNames] = useState<Record<number, string>>({});
  // State for visningsbredde (standard eller mobil)
  const [viewWidth, setViewWidth] = useState<'standard' | 'mobile'>('standard');

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
    
    const { jsx, code } = generateFromPrompt(prompt, newPropsMap);
    setComponent(jsx);
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
            {/* Props Panel - vises før kode */}
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
                </div>
              </div>
              <div 
                className="generator-preview"
                style={viewWidth === 'mobile' ? { 
                  margin: '0 auto',
                  width: 'fit-content'
                } : {}}
              >
                <div 
                  className={viewWidth === 'mobile' ? 'generator-preview-mobile-wrapper' : ''}
                  style={viewWidth === 'mobile' ? { 
                    maxWidth: '320px',
                    width: '320px',
                    boxSizing: 'border-box'
                  } : {}}
                >
                  {component}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

