import { getAppUrl } from "@carbon/auth";
import { cn, Table } from "@carbon/react";
import { Link } from "@remix-run/react";
import { type ComponentProps, memo } from "react";
import ReactMarkdown from 'react-markdown';


type ResponseProps = ComponentProps<typeof ReactMarkdown> & {
  className?: string;
};

// Custom ul component with customizable className
const CustomUnorderedList = ({
  node,
  children,
  className,
  ...props
}: {
  node?: any;
  children?: React.ReactNode;
  className?: string;
}) => (
  <ul className={cn("list-none m-0 p-0", className)} {...props}>
    {children}
  </ul>
);

// Custom ol component with customizable className (no numbers)
const CustomOrderedList = ({
  node,
  children,
  className,
  ...props
}: {
  node?: any;
  children?: React.ReactNode;
  className?: string;
}) => (
  <ol
    className={cn("list-none m-0 p-0", className)}
    {...props}
    data-streamdown="unordered-list"
  >
    {children}
  </ol>
);

// Custom li component to remove padding
const CustomListItem = ({
  node,
  children,
  className,
  ...props
}: {
  node?: any;
  children?: React.ReactNode;
  className?: string;
}) => (
  <li
    className={cn("py-0 my-0 leading-none", className)}
    {...props}
    data-streamdown="list-item"
  >
    {children}
  </li>
);

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <div className={cn(
      "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 space-y-4",
      className,
    )}>
    <ReactMarkdown
      
      components={{
        ul: (props) => <CustomUnorderedList {...props} />,
        ol: (props) => <CustomOrderedList {...props} />,
        li: (props) => <CustomListItem {...props} />,
        h2: ({ children, node, ...props }) => (
          <h3
            className="font-medium text-sm text-primary tracking-wide"
            {...props}
          >
            {children}
          </h3>
        ),
        h3: ({ children, node, ...props }) => (
          <h3
            className="font-medium text-sm text-primary tracking-wide"
            {...props}
          >
            {children}
          </h3>
        ),
        h4: ({ children, node, ...props }) => (
          <h4
            className="font-medium text-sm text-primary tracking-wide"
            {...props}
          >
            {children}
          </h4>
        ),
        table: (props) => <Table {...props} className="border" />,
        a: (props) => {
          // if the href starts with the app url, open in the same window
          if (props.href?.startsWith(getAppUrl())) {
            return (
              <Link to={props.href} className="underline">
                {props.children}
              </Link>
            );
          }
          
          return <a {...props} className="underline" />;
        },
      }}
      {...props}
    />
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = "Response";
