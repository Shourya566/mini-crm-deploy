import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MoreHorizontal, 
  Plus, 
  Search, 
  Users, 
  Pencil, 
  Trash, 
  Filter, 
  CheckCheck,
  AlertCircle,
  PlusCircle,
  MinusCircle,
  ChevronRight,
  Database,
  DollarSign,
  Clock,
  MapPin,
  ShoppingCart,
  MousePointer,
  Loader2,
  ChevronDown,
  Eye
} from 'lucide-react';
import { getSegments, createSegment, updateSegment, deleteSegment } from '@/lib/crmApi';
import { format } from 'date-fns';
import { createCampaign } from '@/lib/crmApi';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AISegmentBuilder from '@/components/AISegmentBuilder';

// Helper function to get icon for condition type
const getConditionIcon = (type) => {
  switch(type) {
    case 'spend': return <DollarSign className="h-4 w-4" />;
    case 'visits': return <MousePointer className="h-4 w-4" />;
    case 'purchases': return <ShoppingCart className="h-4 w-4" />;
    case 'inactive': return <Clock className="h-4 w-4" />;
    case 'location': return <MapPin className="h-4 w-4" />;
    default: return <Database className="h-4 w-4" />;
  }
};

// RuleBuilder component for segment creation
const RuleBuilder = ({ rules, setRules }) => {
  const addCondition = () => {
    const newRules = { ...rules };
    newRules.conditions.push({
      type: 'spend',
      operator: '>',
      value: ''
    });
    setRules(newRules);
  };

  const removeCondition = (index) => {
    const newRules = { ...rules };
    newRules.conditions.splice(index, 1);
    setRules(newRules);
  };

  const updateCondition = (index, field, value) => {
    const newRules = { ...rules };
    newRules.conditions[index][field] = value;
    setRules(newRules);
  };

  const toggleOperator = () => {
    const newRules = { ...rules };
    newRules.operator = newRules.operator === 'AND' ? 'OR' : 'AND';
    setRules(newRules);
  };

  return (
    <Card className="overflow-hidden border-blue-100">
      <div className="bg-blue-50 p-3 flex items-center justify-between">
        <div className="flex items-center">
          <Filter className="h-4 w-4 mr-2 text-blue-600" />
          <h3 className="font-medium text-blue-700">Audience Targeting Rules</h3>
        </div>
        <Button
          type="button"
          variant={rules.operator === 'AND' ? "default" : "outline"}
          size="sm"
          onClick={toggleOperator}
          className="h-8"
        >
          Match {rules.operator === 'AND' ? 'ALL conditions' : 'ANY condition'}
        </Button>
      </div>
      
      <CardContent className="p-4 space-y-4">
        <div className="text-sm text-muted-foreground mb-2">
          Define who should be included in this segment by creating rules based on customer data.
        </div>
        
        <div className="space-y-3">
          {rules.conditions.map((condition, index) => (
            <div key={index} className="p-3 border rounded-md bg-slate-50 relative group">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="min-w-[200px]">
                  <Label htmlFor={`condition-type-${index}`} className="text-xs mb-1 block">
                    Field
                  </Label>
                  <Select
                    id={`condition-type-${index}`}
                    value={condition.type}
                    onValueChange={(value) => updateCondition(index, 'type', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select field">
                        <div className="flex items-center">
                          {getConditionIcon(condition.type)}
                          <span className="ml-2">
                            {condition.type === 'spend' ? 'Total Spend' :
                             condition.type === 'visits' ? 'Visit Count' :
                             condition.type === 'purchases' ? 'Purchase Count' :
                             condition.type === 'inactive' ? 'Inactive Days' :
                             condition.type === 'location' ? 'Location' : 'Select field'}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spend">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" /> Total Spend
                        </div>
                      </SelectItem>
                      <SelectItem value="visits">
                        <div className="flex items-center">
                          <MousePointer className="h-4 w-4 mr-2" /> Visit Count
                        </div>
                      </SelectItem>
                      <SelectItem value="purchases">
                        <div className="flex items-center">
                          <ShoppingCart className="h-4 w-4 mr-2" /> Purchase Count
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" /> Inactive Days
                        </div>
                      </SelectItem>
                      <SelectItem value="location">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" /> Location
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[150px]">
                  <Label htmlFor={`condition-operator-${index}`} className="text-xs mb-1 block">
                    Operator
                  </Label>
                  <Select
                    id={`condition-operator-${index}`}
                    value={
                      condition.operator === 'greaterThan' ? '>' :
                      condition.operator === 'lessThan' ? '<' :
                      condition.operator === 'equals' ? '=' :
                      condition.operator || '>'
                    }
                    onValueChange={(value) => updateCondition(index, 'operator', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Operator">
                        {condition.operator === '>' || condition.operator === 'greaterThan' ? 'Greater than (>)' :
                         condition.operator === '<' || condition.operator === 'lessThan' ? 'Less than (<)' :
                         condition.operator === '=' || condition.operator === 'equals' ? 'Equal to (=)' :
                         condition.operator === '>=' ? 'Greater/Equal (≥)' :
                         condition.operator === '<=' ? 'Less/Equal (≤)' :
                         condition.operator === 'contains' ? 'Contains' :
                         condition.operator || 'Operator'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">Greater than (&gt;)</SelectItem>
                      <SelectItem value="<">Less than (&lt;)</SelectItem>
                      <SelectItem value="=">Equal to (=)</SelectItem>
                      <SelectItem value=">=">Greater/Equal (≥)</SelectItem>
                      <SelectItem value="<=">Less/Equal (≤)</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor={`condition-value-${index}`} className="text-xs mb-1 block">
                    Value
                  </Label>
                  <Input
                    id={`condition-value-${index}`}
                    placeholder={condition.type === 'spend' ? "e.g. 10000" : 
                                condition.type === 'visits' ? "e.g. 5" :
                                condition.type === 'purchases' ? "e.g. 3" :
                                condition.type === 'inactive' ? "e.g. 30" :
                                condition.type === 'location' ? "e.g. Mumbai" : "Value"}
                    value={condition.value}
                    onChange={(e) => updateCondition(index, 'value', e.target.value)}
                    type={condition.type === 'location' ? 'text' : 'number'}
                  />
                </div>

                <div className="absolute right-2 top-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(index)}
                    className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {index < rules.conditions.length - 1 && (
                <div className="flex items-center mt-3 pt-2 border-t">
                  <div className="text-sm font-medium text-blue-600 flex items-center">
                    <ChevronRight className="h-4 w-4 mr-1" />
                    {rules.operator}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addCondition}
          className="w-full mt-2 border-dashed"
        >
          <PlusCircle className="h-4 w-4 mr-2" /> Add Another Condition
        </Button>
      </CardContent>
    </Card>
  );
};

const SegmentRow = ({ segment, onEdit, onDelete, isHighlighted }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className={`overflow-hidden mb-3 border rounded-lg ${isHighlighted ? 'border-primary shadow-md' : 'border-border'}`}
    >
      <TableRow className="hover:bg-slate-50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <TableCell className="font-medium flex items-center">
          <ChevronDown className={`h-4 w-4 mr-2 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          {segment.name}
        </TableCell>
        <TableCell>
          <Badge variant={segment.type === 'dynamic' ? "default" : "outline"}>
            <Filter className="h-3 w-3 mr-1" />
            {segment.type === 'dynamic' ? 'Rule-based' : 'Static'}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center">
            <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            {segment.memberCount || 0} members
          </div>
        </TableCell>
        <TableCell>{formatDate(segment.createdAt)}</TableCell>
        <TableCell>
          <Badge variant={segment.isActive ? "success" : "secondary"} className={segment.isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
            {segment.isActive ? (
              <>
                <CheckCheck className="h-3 w-3 mr-1" />
                Active
              </>
            ) : (
              'Inactive'
            )}
          </Badge>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(segment)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(segment)}
                className="text-red-600"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <div className="px-4 pb-4 bg-slate-50">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="rules">Targeting Rules</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">{segment.description || 'No description provided.'}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div>
                    <p className="font-medium text-xs text-muted-foreground">Created</p>
                    <p>{formatDate(segment.createdAt)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-xs text-muted-foreground">Last Updated</p>
                    <p>{formatDate(segment.updatedAt) || 'Never'}</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="rules">
              {segment.criteria && segment.criteria.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Rules for this segment:</div>
                  {segment.criteria.map((rule, idx) => (
                    <div key={idx} className="bg-white p-2 rounded border text-sm flex items-center">
                      {getConditionIcon(rule.field)}
                      <span className="mx-2">
                        {rule.field === 'spend' ? 'Total Spend' :
                         rule.field === 'visits' ? 'Visit Count' :
                         rule.field === 'purchases' ? 'Purchase Count' :
                         rule.field === 'inactive' ? 'Inactive Days' :
                         rule.field === 'location' ? 'Location' : rule.field}
                      </span>
                      <span className="text-muted-foreground mx-1">
                        {rule.operator === 'greaterThan' ? '>' :
                         rule.operator === 'lessThan' ? '<' :
                         rule.operator === 'equals' ? '=' : rule.operator}
                      </span>
                      <span className="font-medium">{rule.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">No specific rules defined for this segment.</div>
              )}
            </TabsContent>
            
            <TabsContent value="members">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm text-muted-foreground">
                  This segment contains <span className="font-medium">{segment.memberCount || 0}</span> members.
                </div>
                <Button size="sm" variant="outline" className="text-xs h-8">
                  <Eye className="h-3 w-3 mr-1" /> View Members
                </Button>
              </div>
              
              <div className="bg-white p-3 rounded border text-sm">
                <div className="text-muted-foreground mb-2">Member sample:</div>
                {segment.memberCount ? (
                  <div className="grid grid-cols-1 gap-2">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div>
                          <div className="font-medium">Sample User {idx + 1}</div>
                          <div className="text-xs text-muted-foreground">user{idx + 1}@example.com</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="italic text-muted-foreground">No members in this segment</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </motion.div>
  );
};

const SegmentSkeleton = () => {
  return (
    <div className="mb-3 border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-[200px]" />
          <Skeleton className="h-4 w-[120px]" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
};

const Segments = () => {
  const [segments, setSegments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'dynamic',
  });

  // Rules state for dynamic segments
  const [rules, setRules] = useState({
    operator: 'AND',
    conditions: [{ type: 'spend', operator: '>', value: '' }],
  });

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const data = await getSegments();
      setSegments(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching segments:', err);
      const errorMessage = err.response?.data?.error?.message || 
                           err.response?.data?.message || 
                           err.message || 
                           'Failed to load segments';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      type: 'dynamic',
    });
    setRules({
      operator: 'AND',
      conditions: [{ type: 'spend', operator: '>', value: '' }],
    });
    setEditingSegment(null);
    setDialogOpen(true);
  };

  const handleEdit = (segment) => {
    setFormData({
      name: segment.name,
      description: segment.description || '',
      type: segment.type || 'dynamic',
    });
    
    if (segment.criteria && Array.isArray(segment.criteria) && segment.criteria.length > 0) {
      // Convert backend criteria format to frontend rules format
      const conditions = segment.criteria.map(criteria => ({
        type: criteria.field,
        operator: criteria.operator === 'greaterThan' ? '>' :
                 criteria.operator === 'lessThan' ? '<' :
                 criteria.operator === 'equals' ? '=' :
                 criteria.operator,
        value: criteria.value
      }));
      
      setRules({
        operator: 'AND', // Default to AND if not specified
        conditions
      });
    } else {
      setRules({
        operator: 'AND',
        conditions: [{ type: 'spend', operator: '>', value: '' }],
      });
    }
    
    setEditingSegment(segment);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name.trim()) {
      toast.error('Segment name is required');
      return;
    }
    
    // For dynamic segments, ensure at least one valid condition
    if (formData.type === 'dynamic') {
      const validConditions = rules.conditions.filter(
        c => c.type && c.operator && c.value !== undefined && c.value !== ''
      );
      
      if (validConditions.length === 0) {
        toast.error('Please add at least one valid condition with a value');
        return;
      }
    }
    
    const toastId = toast.loading(editingSegment ? 'Updating segment...' : 'Creating segment...');

    try {
      // Convert rules to criteria format for backend
      const criteria = rules.conditions
        .filter(c => c.type && c.operator && c.value !== undefined && c.value !== '')
        .map(condition => {
          // Parse numeric value if applicable
          const isNumericField = condition.type !== 'location';
          const parsedValue = isNumericField && !isNaN(Number(condition.value)) && condition.value.toString().trim() !== ''
            ? Number(condition.value)
            : condition.value;

          return {
            field: condition.type,
            operator: condition.operator === '>' || condition.operator === '>=' ? 'greaterThan' :
                     condition.operator === '<' || condition.operator === '<=' ? 'lessThan' :
                     condition.operator === '=' ? 'equals' :
                     condition.operator,
            value: parsedValue
          };
        });
      
      const segmentData = {
        name: formData.name.trim(),
        description: formData.description ? formData.description.trim() : '',
        type: formData.type,
        criteria,
        // Default user ID for testing
        createdBy: '645a1d7c16f68e412f82f231'
      };
      
      let result;
      if (editingSegment) {
        result = await updateSegment(editingSegment._id, segmentData);
        toast.success('Segment updated successfully!', { id: toastId });
      } else {
        result = await createSegment(segmentData);
        
        // Auto-create companion campaign if applicable (safely isolated)
        try {
          await createCampaign({
            name: `Campaign for ${formData.name.trim()}`,
            description: `Auto-created campaign for segment: ${formData.name.trim()}`,
            type: 'email',
            status: 'draft',
            segmentRules: rules,
            content: {
              subject: `Special offer for ${formData.name.trim()}`,
              body: `Hello, this is a campaign created for the ${formData.name.trim()} segment.`
            }
          });
          toast.success('Segment created and campaign initiated!', { id: toastId });
        } catch (campaignErr) {
          console.warn('Auto-campaign creation warning:', campaignErr);
          toast.success('Segment created successfully!', { id: toastId });
        }
        
        setHighlightedSegmentId(result._id);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          setHighlightedSegmentId(null);
        }, 3000);
      }
      
      setDialogOpen(false);
      await fetchSegments();
    } catch (err) {
      console.error('Error saving segment:', err);
      const errorMessage = err.response?.data?.error?.message || 
                           err.response?.data?.message || 
                           (typeof err.response?.data?.error === 'string' ? err.response?.data?.error : null) || 
                           err.message || 
                           `Failed to ${editingSegment ? 'update' : 'create'} segment`;
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleDelete = async (segment) => {
    if (!window.confirm(`Are you sure you want to delete "${segment.name}"?`)) {
      return;
    }
    
    const toastId = toast.loading('Deleting segment...');
    
    try {
      await deleteSegment(segment._id);
      toast.success('Segment deleted successfully', { id: toastId });
      await fetchSegments();
    } catch (err) {
      console.error('Error deleting segment:', err);
      const errorMessage = err.response?.data?.error?.message || 
                           err.response?.data?.message || 
                           err.message || 
                           'Failed to delete segment';
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredSegments = segments.filter((segment) =>
    segment.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Segments</h1>
          <p className="mt-1 text-muted-foreground">Group your customers based on behavior and attributes</p>
        </div>
        <Button onClick={handleCreate} size="lg" className="h-10">
          <Plus className="h-4 w-4 mr-2" /> Create Segment
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search segments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <SegmentSkeleton key={idx} />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-500 rounded-md flex items-center gap-2 mb-6">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredSegments.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center p-12 bg-slate-50 rounded-md border shadow-sm"
        >
          <Users className="h-14 w-14 mx-auto text-slate-400 mb-4" />
          <p className="text-xl font-medium mb-2">No segments found</p>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">Create a segment to define specific groups of customers for targeted marketing campaigns.</p>
          <Button onClick={handleCreate} size="lg">
            <Plus className="h-4 w-4 mr-2" /> Create your first segment
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-1">
          <Table>
            <TableHeader className="hidden sm:table-header-group bg-slate-50 rounded-lg overflow-hidden">
              <TableRow>
                <TableHead className="font-medium">Name</TableHead>
                <TableHead className="font-medium">Type</TableHead>
                <TableHead className="font-medium">Member Count</TableHead>
                <TableHead className="font-medium">Created</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="w-[80px] font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          
          <AnimatePresence>
            {filteredSegments.map((segment) => (
              <SegmentRow 
                key={segment._id} 
                segment={segment} 
                onEdit={handleEdit} 
                onDelete={handleDelete}
                isHighlighted={highlightedSegmentId === segment._id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="text-xl">
              {editingSegment ? 'Edit Segment' : 'Create New Segment'}
            </DialogTitle>
            <DialogDescription>
              {editingSegment 
                ? 'Update your segment details and targeting rules.' 
                : 'Define a new audience segment with specific targeting criteria.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-medium">
                      Segment Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="E.g. High-value customers"
                      required
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type" className="font-medium">Segment Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleSelectChange('type', value)}
                      name="type"
                    >
                      <SelectTrigger id="type" className="h-10">
                        <SelectValue placeholder="Select segment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dynamic">
                          <div className="flex items-center">
                            <Filter className="h-4 w-4 mr-2" />
                            Dynamic (Rule-based)
                          </div>
                        </SelectItem>
                        <SelectItem value="static">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            Static (Manual selection)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {formData.type === 'dynamic' 
                        ? 'Updates automatically based on rules'
                        : 'Requires manual member management'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="font-medium">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe this segment"
                    rows={3}
                  />
                </div>
                
                {formData.type === 'dynamic' && (
                  <>
                    <div className="bg-slate-50 p-4 rounded-lg border">
                      <h3 className="text-sm font-medium mb-3">AI-Powered Segment Builder</h3>
                      <AISegmentBuilder onRulesGenerated={setRules} />
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-muted-foreground">or define rules manually</span>
                      </div>
                    </div>
                    <RuleBuilder rules={rules} setRules={setRules} />
                  </>
                )}
              </div>
            </div>
            
            <DialogFooter className="px-6 py-4 border-t mt-auto shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="lg">
                {editingSegment ? 'Update Segment' : 'Create Segment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Segments; 